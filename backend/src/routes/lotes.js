import { Router } from 'express'
import { query, transaction } from '../db/client.js'

const router = Router()

// GET /api/lotes — listar lotes con resumen de caja
router.get('/', async (req, res, next) => {
  try {
    const { fecha, producto } = req.query
    let sql = `
      SELECT l.*,
        COALESCE(c.cantidad_vendida, 0) AS vendido,
        COALESCE(c.cantidad_merma, 0)   AS merma,
        COALESCE(c.total_vendido, 0)    AS total_vendido,
        COALESCE(c.cerrado, false)      AS cerrado
      FROM lotes l
      LEFT JOIN caja_produccion c ON c.lote_id = l.id AND c.tenant_id = l.tenant_id
      WHERE l.tenant_id = $1
    `
    const params = [req.tenantId]
    if (fecha)    { params.push(fecha);    sql += ` AND l.fecha = $${params.length}` }
    if (producto) { params.push(`%${producto}%`); sql += ` AND l.producto ILIKE $${params.length}` }
    sql += ' ORDER BY l.fecha DESC, l.creado_en DESC'
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (e) { next(e) }
})

// POST /api/lotes — crear hornada
router.post('/', async (req, res, next) => {
  try {
    const { producto, cantidad, unidad = 'unidad', costo_total = 0, fecha, notas, precio_unitario = 0 } = req.body
    if (!producto || !cantidad) return res.status(400).json({ error: 'producto y cantidad requeridos' })

    const { rows } = await transaction(async (client) => {
      const lote = await client.query(
        `INSERT INTO lotes (tenant_id, producto, cantidad, unidad, costo_total, fecha, notas)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6::date, CURRENT_DATE),$7) RETURNING *`,
        [req.tenantId, producto, cantidad, unidad, costo_total, fecha || null, notas || null]
      )
      const caja = await client.query(
        `INSERT INTO caja_produccion (tenant_id, lote_id, cantidad_inicial, precio_unitario, fecha)
         VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE)) RETURNING *`,
        [req.tenantId, lote.rows[0].id, cantidad, precio_unitario, fecha || null]
      )
      return { ...lote.rows[0], caja: caja.rows[0] }
    })
    res.status(201).json(rows)
  } catch (e) { next(e) }
})

// PATCH /api/lotes/:id/caja — actualizar ventas/merma del día
router.patch('/:id/caja', async (req, res, next) => {
  try {
    const { cantidad_vendida, cantidad_merma, precio_unitario, cerrado } = req.body
    const { rows } = await query(
      `UPDATE caja_produccion
       SET cantidad_vendida = COALESCE($1, cantidad_vendida),
           cantidad_merma   = COALESCE($2, cantidad_merma),
           precio_unitario  = COALESCE($3, precio_unitario),
           cerrado          = COALESCE($4, cerrado)
       WHERE lote_id = $5 AND tenant_id = $6 RETURNING *`,
      [cantidad_vendida, cantidad_merma, precio_unitario, cerrado, req.params.id, req.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Lote no encontrado' })
    res.json(rows[0])
  } catch (e) { next(e) }
})

// DELETE /api/lotes/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      'DELETE FROM lotes WHERE id=$1 AND tenant_id=$2 RETURNING id',
      [req.params.id, req.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Lote no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
})

export default router
