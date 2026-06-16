import { Router } from 'express'
import { query, transaction } from '../db/client.js'

const router = Router()

// GET /api/recetas — todas las recetas con ingredientes
router.get('/', async (req, res, next) => {
  try {
    const { rows: recetas } = await query(`
      SELECT r.*, 
        json_agg(
          json_build_object(
            'id', i.id, 'nombre', i.nombre, 'cantidad', i.cantidad,
            'unidad', i.unidad, 'precio', i.precio, 'tipo', i.tipo
          ) ORDER BY i.orden
        ) FILTER (WHERE i.id IS NOT NULL) AS ingredientes,
        p.precio AS pventa, p.presentacion, p.categoria
      FROM recetas r
      LEFT JOIN ingredientes i ON i.receta_id = r.id
      LEFT JOIN productos p ON p.nombre = r.producto
      GROUP BY r.id, p.precio, p.presentacion, p.categoria
      ORDER BY r.producto
    `)
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
      LEFT JOIN productos p ON p.nombre = r.producto
      WHERE r.producto = $1
      GROUP BY r.id, p.precio, p.presentacion, p.categoria
    `, [decodeURIComponent(req.params.producto)])

    if (!rows.length) return res.status(404).json({ error: 'Receta no encontrada' })
    res.json({ ...rows[0], ingredientes: rows[0].ingredientes || [] })
  } catch (e) { next(e) }
})

// POST /api/recetas — crear o actualizar receta completa
router.post('/', async (req, res, next) => {
  const { producto, piezas, peso_por_pieza, merma_pct, notas, ingredientes = [] } = req.body
  if (!producto || !piezas) return res.status(400).json({ error: 'producto y piezas son requeridos' })

  try {
    const receta = await transaction(async (client) => {
      // Upsert receta
      const { rows: [r] } = await client.query(`
        INSERT INTO recetas (producto, piezas, peso_por_pieza, merma_pct, notas)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (producto) DO UPDATE SET
          piezas = EXCLUDED.piezas,
          peso_por_pieza = EXCLUDED.peso_por_pieza,
          merma_pct = EXCLUDED.merma_pct,
          notas = EXCLUDED.notas,
          actualizado_en = NOW()
        RETURNING *
      `, [producto, piezas, peso_por_pieza || 0, merma_pct || 0, notas || ''])

      // Reemplazar ingredientes
      await client.query('DELETE FROM ingredientes WHERE receta_id = $1', [r.id])
      if (ingredientes.length) {
        const vals = ingredientes.map((ing, idx) => `($${idx * 6 + 1}, $${idx * 6 + 2}, $${idx * 6 + 3}, $${idx * 6 + 4}, $${idx * 6 + 5}, $${idx * 6 + 6})`)
        const params = ingredientes.flatMap((ing, idx) => [r.id, ing.nombre, ing.cantidad, ing.unidad, ing.precio || 0, ing.tipo || 'directo'])
        await client.query(`INSERT INTO ingredientes (receta_id, nombre, cantidad, unidad, precio, tipo) VALUES ${vals}`, params)
      }
      return r
    })

    // Retornar receta completa con ingredientes
    const { rows } = await query(`
      SELECT r.*, json_agg(json_build_object(
        'nombre', i.nombre, 'cantidad', i.cantidad, 'unidad', i.unidad, 'precio', i.precio, 'tipo', i.tipo
      )) FILTER (WHERE i.id IS NOT NULL) AS ingredientes,
      p.precio AS pventa, p.presentacion, p.categoria
      FROM recetas r
      LEFT JOIN ingredientes i ON i.receta_id = r.id
      LEFT JOIN productos p ON p.nombre = r.producto
      WHERE r.id = $1 GROUP BY r.id, p.precio, p.presentacion, p.categoria
    `, [receta.id])

    res.status(201).json({ ...rows[0], ingredientes: rows[0].ingredientes || [] })
  } catch (e) { next(e) }
})

// PUT /api/recetas/:id — actualizar por ID
router.put('/:id', async (req, res, next) => {
  const { piezas, peso_por_pieza, merma_pct, notas, ingredientes = [] } = req.body
  try {
    await transaction(async (client) => {
      await client.query(`
        UPDATE recetas SET piezas=$1, peso_por_pieza=$2, merma_pct=$3, notas=$4, actualizado_en=NOW()
        WHERE id=$5
      `, [piezas, peso_por_pieza || 0, merma_pct || 0, notas || '', req.params.id])

      await client.query('DELETE FROM ingredientes WHERE receta_id=$1', [req.params.id])
      if (ingredientes.length) {
        const vals = ingredientes.map((_, i) => `($${i*6+1},$${i*6+2},$${i*6+3},$${i*6+4},$${i*6+5},$${i*6+6})`)
        await client.query(
          `INSERT INTO ingredientes (receta_id,nombre,cantidad,unidad,precio,tipo) VALUES ${vals}`,
          ingredientes.flatMap(i => [req.params.id, i.nombre, i.cantidad, i.unidad, i.precio||0, i.tipo||'directo'])
        )
      }
    })
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// DELETE /api/recetas/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM recetas WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// POST /api/recetas/import-csv — importar múltiples recetas desde CSV
router.post('/import-csv', async (req, res, next) => {
  const { filas = [] } = req.body
  if (!filas.length) return res.status(400).json({ error: 'Sin filas para importar' })

  try {
    // Agrupar por producto
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
          INSERT INTO recetas (producto, piezas) VALUES ($1, 100)
          ON CONFLICT (producto) DO UPDATE SET actualizado_en=NOW() RETURNING *
        `, [producto])
        await client.query('DELETE FROM ingredientes WHERE receta_id=$1', [r.id])
        const vals = ingredientes.map((_, i) => `($${i*6+1},$${i*6+2},$${i*6+3},$${i*6+4},$${i*6+5},$${i*6+6})`)
        await client.query(
          `INSERT INTO ingredientes (receta_id,nombre,cantidad,unidad,precio,tipo) VALUES ${vals}`,
          ingredientes.flatMap(i => [r.id, i.nombre, i.cantidad, i.unidad, i.precio, i.tipo])
        )
      })
      importadas++
    }

    res.json({ importadas, total: Object.keys(mapa).length })
  } catch (e) { next(e) }
})

export default router
