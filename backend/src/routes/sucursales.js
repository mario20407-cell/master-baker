import { Router } from 'express'
import { query } from '../db/client.js'
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js'

const router = Router()

router.use(requireAuth)

// GET /api/sucursales
router.get('/', requirePermission('ver_produccion'), async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM sucursales WHERE tenant_id = $1 ORDER BY nombre',
      [req.tenantId]
    )
    res.json(rows)
  } catch (e) { next(e) }
})

// POST /api/sucursales
router.post('/', requirePermission('gestionar_produccion'), async (req, res, next) => {
  try {
    const { nombre, direccion } = req.body
    if (!nombre) return res.status(400).json({ error: 'nombre requerido' })
    const { rows } = await query(
      'INSERT INTO sucursales (tenant_id, nombre, direccion) VALUES ($1,$2,$3) RETURNING *',
      [req.tenantId, nombre, direccion || null]
    )
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

// PATCH /api/sucursales/:id
router.patch('/:id', requirePermission('gestionar_produccion'), async (req, res, next) => {
  try {
    const { nombre, direccion, activo } = req.body
    const { rows } = await query(
      `UPDATE sucursales SET
        nombre    = COALESCE($1, nombre),
        direccion = COALESCE($2, direccion),
        activo    = COALESCE($3, activo)
       WHERE id = $4 AND tenant_id = $5 RETURNING *`,
      [nombre, direccion, activo, req.params.id, req.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Sucursal no encontrada' })
    res.json(rows[0])
  } catch (e) { next(e) }
})

export default router
