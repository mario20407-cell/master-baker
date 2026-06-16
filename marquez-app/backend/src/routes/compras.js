import { Router } from 'express'
import { query, transaction } from '../db/client.js'

const router = Router()

// GET /api/compras
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT f.*,
        json_agg(json_build_object(
          'id', fi.id, 'producto', fi.producto, 'cantidad', fi.cantidad,
          'precio_actual', fi.precio_actual, 'precio_anterior', fi.precio_anterior,
          'variacion_pct', fi.variacion_pct, 'alerta', fi.alerta
        )) AS items
      FROM facturas f
      LEFT JOIN factura_items fi ON fi.factura_id = f.id
      GROUP BY f.id
      ORDER BY f.fecha DESC, f.creado_en DESC
      LIMIT 100
    `)
    res.json(rows)
  } catch (e) { next(e) }
})

// POST /api/compras
router.post('/', async (req, res, next) => {
  const { proveedor, fecha, items = [], notas } = req.body
  if (!items.length) return res.status(400).json({ error: 'items es requerido' })

  try {
    const factura = await transaction(async (client) => {
      const total = items.reduce((s, i) => s + (i.cantidad || 1) * (i.precio_actual || 0), 0)
      const { rows: [f] } = await client.query(`
        INSERT INTO facturas (proveedor, fecha, total, notas)
        VALUES ($1, $2, $3, $4) RETURNING *
      `, [proveedor || 'Sin nombre', fecha || new Date().toISOString().split('T')[0], total, notas || ''])

      for (const item of items) {
        const variacion = item.precio_anterior > 0
          ? ((item.precio_actual - item.precio_anterior) / item.precio_anterior) * 100
          : null
        const alerta = variacion !== null && variacion > 10

        await client.query(`
          INSERT INTO factura_items
            (factura_id, producto, cantidad, precio_actual, precio_anterior, variacion_pct, alerta)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [f.id, item.producto, item.cantidad || 1,
            item.precio_actual || 0, item.precio_anterior || 0,
            variacion ? parseFloat(variacion.toFixed(2)) : null, alerta])
      }
      return f
    })

    // Retornar con items
    const { rows } = await query(`
      SELECT f.*, json_agg(json_build_object(
        'producto', fi.producto, 'cantidad', fi.cantidad,
        'precio_actual', fi.precio_actual, 'variacion_pct', fi.variacion_pct, 'alerta', fi.alerta
      )) AS items
      FROM facturas f
      LEFT JOIN factura_items fi ON fi.factura_id = f.id
      WHERE f.id = $1 GROUP BY f.id
    `, [factura.id])

    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

export default router
