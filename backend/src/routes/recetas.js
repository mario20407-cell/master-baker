/**
 * /api/recetas — v2.8 multi-tenant.
 * Nota: ingredientes no lleva tenant_id propio porque su aislamiento
 * viene heredado vía receta_id -> recetas.tenant_id (no hay forma de
 * que un ingrediente "se cuele" entre tenants sin pasar por una receta
 * que ya está filtrada). Igual lo agregamos en la migración para
 * queries directas futuras, pero aquí basta filtrar por receta.tenant_id.
 */
import { Router } from 'express'
import { query, transaction } from '../db/client.js'

const router = Router()

// GET /api/recetas — todas las recetas del tenant, con ingredientes
router.get('/', async (req, res, next) => {
  try {
    const { rows: recetas } = await query(`
      SELECT r.*,
        json_agg(
          json_build_object(
            'id', i.id, 'nombre', i.nombre, 'cantidad', i.cantidad,
            'unidad', i.unidad,
            'precio', COALESCE(inv.costo_unitario, i.precio, 0),
            'precio_inventario', inv.costo_unitario,
            'tipo', i.tipo,
            'unidad_inventario', COALESCE(i.unidad_inventario, inv.unidad)
          ) ORDER BY i.orden
        ) FILTER (WHERE i.id IS NOT NULL) AS ingredientes,
        p.precio AS pventa, p.presentacion, p.categoria
      FROM recetas r
      LEFT JOIN ingredientes i ON i.receta_id = r.id
      LEFT JOIN inventario inv ON LOWER(TRIM(inv.nombre)) = LOWER(TRIM(i.nombre)) AND inv.tenant_id = r.tenant_id
      LEFT JOIN productos p ON p.nombre = r.producto AND p.tenant_id = r.tenant_id
      WHERE r.tenant_id = $1
      GROUP BY r.id, p.precio, p.presentacion, p.categoria
      ORDER BY r.producto
    `, [req.tenantId])
    res.json(recetas.map(r => ({ ...r, ingredientes: r.ingredientes || [] })))
  } catch (e) { next(e) }
})

// GET /api/recetas/:producto
router.get('/:producto', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT r.*,
        json_agg(json_build_object(
          'id', i.id, 'nombre', i.nombre, 'cantidad', i.cantidad,
          'unidad', i.unidad, 'precio', i.precio, 'tipo', i.tipo
        ) ORDER BY i.orden) FILTER (WHERE i.id IS NOT NULL) AS ingredientes,
        p.precio AS pventa, p.presentacion, p.categoria
      FROM recetas r
      LEFT JOIN ingredientes i ON i.receta_id = r.id
      LEFT JOIN inventario inv ON LOWER(TRIM(inv.nombre)) = LOWER(TRIM(i.nombre)) AND inv.tenant_id = r.tenant_id
      LEFT JOIN productos p ON p.nombre = r.producto AND p.tenant_id = r.tenant_id
      WHERE r.producto = $1 AND r.tenant_id = $2
      GROUP BY r.id, p.precio, p.presentacion, p.categoria
    `, [decodeURIComponent(req.params.producto), req.tenantId])

    if (!rows.length) return res.status(404).json({ error: 'Receta no encontrada' })
    res.json({ ...rows[0], ingredientes: rows[0].ingredientes || [] })
  } catch (e) { next(e) }
})

// POST /api/recetas — crear o actualizar receta completa
router.post('/', async (req, res, next) => {
  const { producto, piezas, peso_por_pieza, merma_pct, notas, ingredientes = [] } = req.body
  const tenantId = req.tenantId
  if (!producto || !piezas) return res.status(400).json({ error: 'producto y piezas son requeridos' })

  try {
    const receta = await transaction(async (client) => {
      // Upsert receta — el conflicto ahora es por (tenant_id, producto)
      const { rows: [r] } = await client.query(`
        INSERT INTO recetas (tenant_id, producto, piezas, peso_por_pieza, merma_pct, notas)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (tenant_id, producto) DO UPDATE SET
          piezas = EXCLUDED.piezas,
          peso_por_pieza = EXCLUDED.peso_por_pieza,
          merma_pct = EXCLUDED.merma_pct,
          notas = EXCLUDED.notas,
          actualizado_en = NOW()
        RETURNING *
      `, [tenantId, producto, piezas, peso_por_pieza || 0, merma_pct || 0, notas || ''])

      await client.query('DELETE FROM ingredientes WHERE receta_id = $1', [r.id])
      if (ingredientes.length) {
        const vals = ingredientes.map((ing, idx) => `($, $, $, $, $, $, $, $)`)
        const params = ingredientes.flatMap(ing => [tenantId, r.id, ing.nombre, ing.cantidad, ing.unidad, ing.precio || 0, ing.tipo || 'directo', ing.unidad_inventario || null])
        await client.query(`INSERT INTO ingredientes (tenant_id, receta_id, nombre, cantidad, unidad, precio, tipo, unidad_inventario) VALUES ${vals}`, params)
      }
      return r
    })

    const { rows } = await query(`
      SELECT r.*, json_agg(json_build_object(
        'nombre', i.nombre, 'cantidad', i.cantidad, 'unidad', i.unidad, 'precio', i.precio, 'tipo', i.tipo
      )) FILTER (WHERE i.id IS NOT NULL) AS ingredientes,
      p.precio AS pventa, p.presentacion, p.categoria
      FROM recetas r
      LEFT JOIN ingredientes i ON i.receta_id = r.id
      LEFT JOIN productos p ON p.nombre = r.producto AND p.tenant_id = r.tenant_id
      WHERE r.id = $1 GROUP BY r.id, p.precio, p.presentacion, p.categoria
    `, [receta.id])

    res.status(201).json({ ...rows[0], ingredientes: rows[0].ingredientes || [] })
  } catch (e) { next(e) }
})

// PUT /api/recetas/:id — actualizar por ID (solo si pertenece al tenant)
router.put('/:id', async (req, res, next) => {
  const { piezas, peso_por_pieza, merma_pct, notas, ingredientes = [] } = req.body
  const tenantId = req.tenantId
  try {
    const actualizada = await transaction(async (client) => {
      const { rowCount } = await client.query(`
        UPDATE recetas SET piezas=$1, peso_por_pieza=$2, merma_pct=$3, notas=$4, actualizado_en=NOW()
        WHERE id=$5 AND tenant_id=$6
      `, [piezas, peso_por_pieza || 0, merma_pct || 0, notas || '', req.params.id, tenantId])

      if (!rowCount) return false

      await client.query('DELETE FROM ingredientes WHERE receta_id=$1', [req.params.id])
      if (ingredientes.length) {
        const vals = ingredientes.map((_, i) => `($${i*7+1},$${i*7+2},$${i*7+3},$${i*7+4},$${i*7+5},$${i*7+6},$${i*7+7})`)
        await client.query(
          `INSERT INTO ingredientes (tenant_id,receta_id,nombre,cantidad,unidad,precio,tipo,unidad_inventario) VALUES ${vals}`,
          ingredientes.flatMap(i => [tenantId, req.params.id, i.nombre, i.cantidad, i.unidad, i.precio||0, i.tipo||'directo', i.unidad_inventario||null])
        )
      }
      return true
    })

    if (!actualizada) return res.status(404).json({ error: 'Receta no encontrada' })
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// DELETE /api/recetas/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM recetas WHERE id=$1 AND tenant_id=$2', [req.params.id, req.tenantId])
    if (!rowCount) return res.status(404).json({ error: 'Receta no encontrada' })
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// POST /api/recetas/import-csv — importar múltiples recetas desde CSV
router.post('/import-csv', async (req, res, next) => {
  const { filas = [] } = req.body
  const tenantId = req.tenantId
  if (!filas.length) return res.status(400).json({ error: 'Sin filas para importar' })

  try {
    const mapa = {}
    filas.forEach(f => {
      if (!f.Producto || !f.Ingrediente) return
      if (!mapa[f.Producto]) mapa[f.Producto] = []
      mapa[f.Producto].push({
        nombre: f.Ingrediente,
        cantidad: parseFloat(f.Cantidad) || 0,
        unidad: f.Unidad || 'kg',
        precio: parseFloat(f.Precio_unitario_CS) || 0,
        tipo: f.Ingrediente.toLowerCase().includes('indirecto') ? 'indirecto' : 'directo',
      })
    })

    let importadas = 0
    for (const [producto, ingredientes] of Object.entries(mapa)) {
      if (!ingredientes.some(i => i.cantidad > 0)) continue
      await transaction(async (client) => {
        const { rows: [r] } = await client.query(`
          INSERT INTO recetas (tenant_id, producto, piezas) VALUES ($1, $2, 100)
          ON CONFLICT (tenant_id, producto) DO UPDATE SET actualizado_en=NOW() RETURNING *
        `, [tenantId, producto])
        await client.query('DELETE FROM ingredientes WHERE receta_id=$1', [r.id])
        const vals = ingredientes.map((_, i) => `($${i*7+1},$${i*7+2},$${i*7+3},$${i*7+4},$${i*7+5},$${i*7+6},$${i*7+7})`)
        await client.query(
          `INSERT INTO ingredientes (tenant_id,receta_id,nombre,cantidad,unidad,precio,tipo,unidad_inventario) VALUES ${vals}`,
          ingredientes.flatMap(i => [tenantId, r.id, i.nombre, i.cantidad, i.unidad, i.precio, i.tipo, i.unidad_inventario||null])
        )
      })
      importadas++
    }

    res.json({ importadas, total: Object.keys(mapa).length })
  } catch (e) { next(e) }
})

export default router
