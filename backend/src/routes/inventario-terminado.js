import { Router } from 'express'
import { query, transaction } from '../db/client.js'

import { requireAuth, requirePermission } from '../middleware/authMiddleware.js'
import { distribuirLote, verificarSugerencia } from '../services/produccionService.js'

const router = Router()

router.use(requireAuth)

// GET /api/inventario-terminado?sucursal_id=&producto=
router.get('/', requirePermission('ver_produccion'), async (req, res, next) => {
  try {
    const { sucursal_id, producto } = req.query
    let sql = `
      SELECT it.*, s.nombre AS sucursal_nombre
      FROM inventario_terminado it
      JOIN sucursales s ON s.id = it.sucursal_id
      WHERE it.tenant_id = $1
    `
    const params = [req.tenantId]
    if (sucursal_id) { params.push(sucursal_id); sql += ` AND it.sucursal_id = $${params.length}` }
    if (producto)    { params.push(`%${producto}%`); sql += ` AND it.producto ILIKE $${params.length}` }
    sql += ' ORDER BY s.nombre, it.producto'
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (e) { next(e) }
})

// POST /api/inventario-terminado/distribuir — distribuir lote entre sucursales
// body: { lote_id, distribuciones: [{ sucursal_id, cantidad }] }
router.post('/distribuir', requirePermission('gestionar_produccion'), async (req, res, next) => {
  try {
    const { lote_id, distribuciones } = req.body
    if (!lote_id || !Array.isArray(distribuciones) || distribuciones.length === 0)
      return res.status(400).json({ error: 'lote_id y distribuciones requeridos' })

    // Verificar que el lote pertenece al tenant
    const loteRes = await query(
      'SELECT * FROM lotes WHERE id = $1 AND tenant_id = $2',
      [lote_id, req.tenantId]
    )
    if (!loteRes.rows[0]) return res.status(404).json({ error: 'Lote no encontrado' })
    const lote = loteRes.rows[0]

    const result = await transaction(async (client) => {
      return distribuirLote(client, req.tenantId, lote, distribuciones)
    })
    res.status(201).json(result)
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message })
    next(e)
  }
})

// PATCH /api/inventario-terminado/:id — ajuste manual de stock o stock_minimo
router.patch('/:id', requirePermission('gestionar_produccion'), async (req, res, next) => {
  try {
    const { stock, stock_minimo } = req.body
    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE inventario_terminado
         SET stock        = COALESCE($1, stock),
             stock_minimo = COALESCE($2, stock_minimo),
             actualizado_en = NOW()
         WHERE id = $3 AND tenant_id = $4 RETURNING *`,
        [stock, stock_minimo, req.params.id, req.tenantId]
      )
      const registro = rows[0]
      if (!registro) throw Object.assign(new Error('Registro no encontrado'), { status: 404 })

      await verificarSugerencia(
        client, req.tenantId, registro.sucursal_id, registro.producto,
        Number(registro.stock), Number(registro.stock_minimo)
      )
      return registro
    })
    res.json(result)
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: e.message })
    next(e)
  }
})

export default router
