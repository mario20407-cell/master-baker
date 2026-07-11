import { Router } from 'express'
import { query } from '../db/client.js'
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js'

const router = Router()

router.use(requireAuth)

// GET /api/sugerencias-produccion?sucursal_id=&atendida=false
router.get('/', requirePermission('ver_produccion'), async (req, res, next) => {
  try {
    const { sucursal_id, atendida } = req.query
    let sql = `
      SELECT sp.*, s.nombre AS sucursal_nombre
      FROM sugerencias_produccion sp
      JOIN sucursales s ON s.id = sp.sucursal_id
      WHERE sp.tenant_id = $1
    `
    const params = [req.tenantId]
    if (sucursal_id) { params.push(sucursal_id); sql += ` AND sp.sucursal_id = $${params.length}` }
    if (atendida !== undefined) { params.push(atendida === 'true'); sql += ` AND sp.atendida = $${params.length}` }
    else { sql += ` AND sp.atendida = false` }
    sql += ' ORDER BY sp.creado_en DESC'
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (e) { next(e) }
})

// PATCH /api/sugerencias-produccion/:id — marcar atendida
router.patch('/:id', requirePermission('gestionar_produccion'), async (req, res, next) => {
  try {
    const { atendida = true } = req.body
    const { rows } = await query(
      `UPDATE sugerencias_produccion SET atendida = $1
       WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [atendida, req.params.id, req.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Sugerencia no encontrada' })
    res.json(rows[0])
  } catch (e) { next(e) }
})

export default router
