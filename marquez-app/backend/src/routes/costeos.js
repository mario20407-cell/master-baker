import { Router } from 'express'
import { query } from '../db/client.js'

const router = Router()

// GET /api/costeos
router.get('/', async (req, res, next) => {
  try {
    const { producto, limit = 50 } = req.query
    const params = []
    let where = ''
    if (producto) { params.push(producto); where = 'WHERE producto = $1' }
    params.push(parseInt(limit))
    const { rows } = await query(
      `SELECT * FROM costeos ${where} ORDER BY creado_en DESC LIMIT $${params.length}`,
      params
    )
    res.json(rows)
  } catch (e) { next(e) }
})

// POST /api/costeos
router.post('/', async (req, res, next) => {
  const { producto, piezas_obj, piezas_reales, costo_directo, costo_indirecto,
    costo_total, costo_unitario, precio_venta, margen_pct, utilidad_neta, factor_escala } = req.body
  try {
    const { rows } = await query(`
      INSERT INTO costeos (producto, piezas_obj, piezas_reales, costo_directo, costo_indirecto,
        costo_total, costo_unitario, precio_venta, margen_pct, utilidad_neta, aprobado, factor_escala)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [producto, piezas_obj, piezas_reales, costo_directo, costo_indirecto,
        costo_total, costo_unitario, precio_venta, margen_pct, utilidad_neta,
        margen_pct >= 57, factor_escala || 1])
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

export default router
