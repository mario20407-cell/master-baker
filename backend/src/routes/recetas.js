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

// Helper: resuelve sub-recetas recursivamente (máximo 3 niveles)
async function resolverSubRecetas(ingredientes, tenantId, nivel = 0) {
  if (nivel >= 3 || !ingredientes?.length) return ingredientes
  
  const resultado = []
  for (const ing of ingredientes) {
    if (ing.tipo !== 'subreceta' || !ing.subreceta_nombre) {
      resultado.push(ing)
      continue
    }
    
    const { rows: subRows } = await query(`
      SELECT r.piezas,
        json_agg(json_build_object(
          'nombre', i.nombre, 'cantidad', i.cantidad, 'unidad', i.unidad,
          'precio', COALESCE(inv.costo_unitario, i.precio, 0),
          'tipo', i.tipo, 'unidad_inventario', COALESCE(i.unidad_inventario, inv.unidad),
          'subreceta_nombre', i.subreceta_nombre
        ) ORDER BY i.orden) FILTER (WHERE i.id IS NOT NULL) AS ingredientes
      FROM recetas r
      LEFT JOIN ingredientes i ON i.receta_id = r.id
      LEFT JOIN inventario inv ON LOWER(TRIM(inv.nombre)) = LOWER(TRIM(i.nombre)) AND inv.tenant_id = r.tenant_id
      WHERE r.producto = $1 AND r.tenant_id = $2
      GROUP BY r.id
    `, [ing.subreceta_nombre, tenantId])
    
    if (!subRows.length) { resultado.push(ing); continue }
    
    const sub = subRows[0]
    const subIngs = await resolverSubRecetas(sub.ingredientes || [], tenantId, nivel + 1)
    const factor = parseFloat(ing.cantidad) || 1
    const piezasSub = parseFloat(sub.piezas) || 1
    
    for (const si of subIngs) {
      resultado.push({
        ...si,
        cantidad: (parseFloat(si.cantidad) * factor) / piezasSub,
        _de_subreceta: ing.subreceta_nombre
      })
    }
  }
  return resultado
}

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
            'unidad_inventario', COALESCE(i.unidad_inventario, inv.unidad),
            'subreceta_nombre', i.subreceta_nombre
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
    const recetasResueltas = await Promise.all(recetas.map(async r => {
      const ings = await resolverSubRecetas(r.ingredientes || [], req.tenantId)
      return { ...r, ingredientes: ings }
    }))
    res.json(recetasResueltas)
  } catch (e) { next(e) }
})

// GET /api/recetas/:producto
router.get('/:producto', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT r.*,
        json_agg(json_build_object(
          'id', i.id, 'nombre', i.nombre, 'cantidad', i.cantidad,
          'unidad', i.unidad,
          'precio', COALESCE(inv.costo_unitario, i.precio, 0),
          'precio_inventario', inv.costo_unitario,
          'tipo', i.tipo,
          'unidad_inventario', COALESCE(i.unidad_inventario, inv.unidad),
          'subreceta_nombre', i.subreceta_nombre
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
    const ings = await resolverSubRecetas(rows[0].ingredientes || [], req.tenantId)
    res.json({ ...rows[0], ingredientes: ings })
  } catch (e) { next(e) }
})

// POST /api/recetas — crear o actualizar receta completa
router.post('/', async (req, res, next) => {
  const { producto, piezas, peso_por_pieza, merma_pct, notas, ingredientes = [] } = req.body
  const tenantId = req.tenantId
  if (!producto || !piezas) return res.status(400).json({ error: 'producto y piezas son requeridos' })

  try {
    const receta = await transaction(async (client) => {
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
        const vals = ingredientes.map((ing, idx) => `($${idx*9+1},$${idx*9+2},$${idx*9+3},$${idx*9+4},$${idx*9+5},$${idx*9+6},$${idx*9+7},$${idx*9+8},$${idx*9+9})`)
        const params = ingredientes.flatMap(ing => [tenantId, r.id, ing.nombre, ing.cantidad, ing.unidad, ing.precio || 0, ing.tipo || 'directo', ing.unidad_inventario || null, ing.subreceta_nombre || null])
        await client.query(`INSERT INTO ingredientes (tenant_id, receta_id, nombre, cantidad, unidad, precio, tipo, unidad_inventario, subreceta_nombre) VALUES ${vals}`, params)
      }
      return r
    })

    const { rows } = await query(`
      SELECT r.*, json_agg(json_build_object(
        'nombre', i.nombre, 'cantidad', i.cantidad, 'unidad', i.unidad,
        'precio', COALESCE(inv.costo_unitario, i.precio, 0),
        'tipo', i.tipo, 'unidad_inventario', COALESCE(i.unidad_inventario, inv.unidad)
      )) FILTER (WHERE i.id IS NOT NULL) AS ingredientes,
      p.precio AS pventa, p.presentacion, p.categoria
      FROM recetas r
      LEFT JOIN ingredientes i ON i.receta_id = r.id
      LEFT JOIN inventario inv ON LOWER(TRIM(inv.nombre)) = LOWER(TRIM(i.nombre)) AND inv.tenant_id = r.tenant_id
      LEFT JOIN productos p ON p.nombre = r.producto AND p.tenant_id = r.tenant_id
      WHERE r.id = $1 GROUP BY r.id, p.precio, p.presentacion, p.categoria
    `, [receta.id])

    res.status(201).json({ ...rows[0], ingredientes: rows[0].ingredientes || [] })
  } catch (e) { next(e) }
})

// PUT /api/recetas/:id
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
        const vals = ingredientes.map((_, i) => `($${i*9+1},$${i*9+2},$${i*9+3},$${i*9+4},$${i*9+5},$${i*9+6},$${i*9+7},$${i*9+8},$${i*9+9})`)
        await client.query(
          `INSERT INTO ingredientes (tenant_id,receta_id,nombre,cantidad,unidad,precio,tipo,unidad_inventario,subreceta_nombre) VALUES ${vals}`,
          ingredientes.flatMap(i => [tenantId, req.params.id, i.nombre, i.cantidad, i.unidad, i.precio||0, i.tipo||'directo', i.unidad_inventario||null, i.subreceta_nombre||null])
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

// POST /api/recetas/import-csv
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
        const vals = ingredientes.map((_, i) => `($${i*8+1},$${i*8+2},$${i*8+3},$${i*8+4},$${i*8+5},$${i*8+6},$${i*8+7},$${i*8+8})`)
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