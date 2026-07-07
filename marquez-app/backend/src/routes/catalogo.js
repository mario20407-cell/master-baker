import { Router } from 'express'
import { query } from '../db/client.js'

const router = Router()

// GET /api/catalogo — solo productos del tenant activo
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT p.*,
        CASE WHEN r.id IS NOT NULL THEN true ELSE false END AS tiene_receta
      FROM productos p
      LEFT JOIN recetas r ON r.producto = p.nombre AND r.tenant_id = p.tenant_id
      WHERE p.activo = true AND p.tenant_id = $1
      ORDER BY p.categoria, p.nombre
    `, [req.tenantId])
    res.json(rows)
  } catch (e) { next(e) }
})

// PUT /api/catalogo/:id — actualizar precio (solo si pertenece al tenant)
router.put('/:id', async (req, res, next) => {
  const { precio, presentacion } = req.body
  try {
    const { rows } = await query(
      `UPDATE productos SET precio=$1, presentacion=$2, actualizado_en=NOW()
       WHERE id=$3 AND tenant_id=$4 RETURNING *`,
      [precio, presentacion, req.params.id, req.tenantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json(rows[0])
  } catch (e) { next(e) }
})

export default router
