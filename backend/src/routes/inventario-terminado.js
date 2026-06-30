import { Router } from 'express'
import { query, transaction } from '../db/client.js'
import { checkStockTerminado } from '../services/alertas.js'

const router = Router()

// GET /api/inventario-terminado?sucursal_id=&producto=
router.get('/', async (req, res, next) => {
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
router.post('/distribuir', async (req, res, next) => {
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

    const totalDist = distribuciones.reduce((s, d) => s + Number(d.cantidad), 0)
    if (totalDist > lote.cantidad)
      return res.status(400).json({ error: `Total distribuido (${totalDist}) supera la producción del lote (${lote.cantidad})` })

    const result = await transaction(async (client) => {
      const registros = []
      for (const dist of distribuciones) {
        // Registrar distribución
        await client.query(
          `INSERT INTO lote_distribuciones (tenant_id, lote_id, sucursal_id, cantidad)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (lote_id, sucursal_id) DO UPDATE SET cantidad = lote_distribuciones.cantidad + EXCLUDED.cantidad`,
          [req.tenantId, lote_id, dist.sucursal_id, dist.cantidad]
        )
        // Incrementar inventario terminado
        const inv = await client.query(
          `INSERT INTO inventario_terminado (tenant_id, sucursal_id, producto, stock, unidad)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (tenant_id, sucursal_id, producto)
           DO UPDATE SET stock = inventario_terminado.stock + EXCLUDED.stock,
                         actualizado_en = NOW()
           RETURNING *`,
          [req.tenantId, dist.sucursal_id, lote.producto, dist.cantidad, lote.unidad]
        )
        registros.push(inv.rows[0])
      }
      return registros
    })
    res.status(201).json(result)
    checkStockTerminado(req.tenantId).catch(() => {})
  } catch (e) { next(e) }
})

// PATCH /api/inventario-terminado/:id — ajuste manual de stock o stock_minimo
router.patch('/:id', async (req, res, next) => {
  try {
    const { stock, stock_minimo } = req.body
    const { rows } = await query(
      `UPDATE inventario_terminado
       SET stock        = COALESCE($1, stock),
           stock_minimo = COALESCE($2, stock_minimo),
           actualizado_en = NOW()
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [stock, stock_minimo, req.params.id, req.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Registro no encontrado' })
    res.json(rows[0])
    checkStockTerminado(req.tenantId).catch(() => {})
  } catch (e) { next(e) }
})

export default router
