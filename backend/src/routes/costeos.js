import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import { query } from '../db/client.js'

const router = Router()
router.use(requireAuth)

// GET /api/costeos
router.get('/', async (req, res, next) => {
  try {
    const { producto, limit = 50 } = req.query
    const params = [req.tenantId]
    let where = 'WHERE tenant_id = $1'
    if (producto) { params.push(producto); where += ` AND producto = $${params.length}` }
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
    costo_total, costo_unitario, precio_venta, margen_pct, margen_fiscal_pct,
    costo_fiscal_unitario, utilidad_neta, aprobado_fiscal, factor_escala } = req.body
  try {
    const { rows } = await query(`
      INSERT INTO costeos (tenant_id, producto, piezas_obj, piezas_reales, costo_directo, costo_indirecto,
        costo_total, costo_unitario, precio_venta, margen_pct, margen_fiscal_pct, costo_fiscal_unitario,
        utilidad_neta, aprobado, aprobado_fiscal, factor_escala)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *
    `, [req.tenantId, producto, piezas_obj, piezas_reales, costo_directo, costo_indirecto,
        costo_total, costo_unitario, precio_venta, margen_pct, margen_fiscal_pct || null,
        costo_fiscal_unitario || null, utilidad_neta, margen_pct >= 57, aprobado_fiscal ?? null, factor_escala || 1])
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

export default router
