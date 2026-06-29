import { Router } from 'express'
import { query } from '../db/client.js'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, nombre, email, rol, activo, creado_en FROM usuarios WHERE tenant_id = $1 ORDER BY creado_en',
      [req.tenantId]
    )
    res.json(rows)
  } catch (e) { next(e) }
})

router.post('/', async (req, res, next) => {
  try {
    const { nombre, email, rol = 'operario' } = req.body
    if (!nombre || !email) return res.status(400).json({ error: 'nombre y email requeridos' })
    const { rows } = await query(
      'INSERT INTO usuarios (tenant_id, nombre, email, rol) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.tenantId, nombre, email, rol]
    )
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const { nombre, rol, activo } = req.body
    const { rows } = await query(
      'UPDATE usuarios SET nombre=COALESCE($1,nombre), rol=COALESCE($2,rol), activo=COALESCE($3,activo) WHERE id=$4 AND tenant_id=$5 RETURNING *',
      [nombre, rol, activo, req.params.id, req.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json(rows[0])
  } catch (e) { next(e) }
})

export default router
