/**
 * /api/ventas — Registro y consulta de ventas
 * v2.8 — Multi-tenant: toda query filtra y escribe con tenant_id.
 */
import { Router } from 'express'
import { query, transaction } from '../db/client.js'
import { checkStockTerminado } from '../services/alertas.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

router.use(requireAuth)

// Filtros compartidos por GET / y GET /resumen — construye WHERE + params.
// No aplica default de fecha: cada ruta decide si "sin fecha" significa
// "todas" (lista) o "hoy en Nicaragua" (resumen).
function buildFiltros(q, tenantId) {
  const { fecha, desde, hasta, sucursal_id, producto, canal, metodo_pago } = q
  const conds  = ['v.tenant_id = $1']
  const params = [tenantId]

  if (desde && hasta) {
    params.push(desde); conds.push(`v.fecha >= $${params.length}`)
    params.push(hasta); conds.push(`v.fecha <= $${params.length}`)
  } else if (desde) {
    params.push(desde); conds.push(`v.fecha >= $${params.length}`)
  } else if (hasta) {
    params.push(hasta); conds.push(`v.fecha <= $${params.length}`)
  } else if (fecha) {
    params.push(fecha); conds.push(`v.fecha = $${params.length}`)
  }

  if (sucursal_id)  { params.push(sucursal_id);  conds.push(`v.sucursal_id = $${params.length}`) }
  if (canal)        { params.push(canal);        conds.push(`v.canal = $${params.length}`) }
  if (metodo_pago)  { params.push(metodo_pago);  conds.push(`v.metodo_pago = $${params.length}`) }
  if (producto) {
    params.push(`%${producto}%`)
    conds.push(`EXISTS (
      SELECT 1 FROM venta_items vi2
      WHERE vi2.venta_id = v.id AND vi2.tenant_id = v.tenant_id AND vi2.producto ILIKE $${params.length}
    )`)
  }

  return { conds, params }
}

// ── POST /api/ventas ──────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  const { items, total, metodo_pago = 'efectivo', canal = 'tienda', cliente = 'Sin nombre', fecha, hora, sucursal_id } = req.body
  const tenantId = req.tenantId

  if (!items?.length)          return res.status(400).json({ error: 'La venta debe tener al menos un item' })
  if (!total || total <= 0)    return res.status(400).json({ error: 'El total debe ser mayor a 0' })

  const sumaItems = items.reduce((s, i) => s + (parseFloat(i.precio_unit) * parseInt(i.cantidad)), 0)
  if (Math.abs(sumaItems - parseFloat(total)) > 0.01) {
    return res.status(400).json({ error: `Total declarado (${total}) no coincide con suma de items (${sumaItems.toFixed(2)})` })
  }

  try {
    const venta = await transaction(async (client) => {
      const { rows: [v] } = await client.query(`
        INSERT INTO ventas (tenant_id, fecha, hora, cliente, canal, metodo_pago, total, sucursal_id)
        VALUES (
          $1,
          COALESCE($2::date, (NOW() AT TIME ZONE 'America/Managua')::date),
          COALESCE($3::time, (NOW() AT TIME ZONE 'America/Managua')::time),
          $4, $5, $6, $7, $8
        )
        RETURNING *
      `, [tenantId, fecha || null, hora || null, cliente, canal, metodo_pago, total, sucursal_id || null])

      if (items.length > 0) {
        // Cada fila de items lleva también tenant_id — 4 params por item ahora.
        const vals   = items.map((_, i) => `($1, $2, $${i * 3 + 3}, $${i * 3 + 4}, $${i * 3 + 5})`)
        const params = [tenantId, v.id, ...items.flatMap(i => [i.producto || i.n, parseInt(i.cantidad || i.qty || 1), parseFloat(i.precio_unit || i.p)])]
        await client.query(
          `INSERT INTO venta_items (tenant_id, venta_id, producto, cantidad, precio_unit) VALUES ${vals}`,
          params
        )
      }

      // Descontar inventario_terminado si se indicó sucursal_id
      if (sucursal_id) {
        for (const item of items) {
          const producto  = item.producto || item.n
          const cantidad  = parseInt(item.cantidad || item.qty || 1)

          const { rowCount } = await client.query(
            `UPDATE inventario_terminado
             SET stock = stock - $1, actualizado_en = NOW()
             WHERE tenant_id = $2 AND sucursal_id = $3 AND LOWER(producto) = LOWER($4)
               AND stock >= $1`,
            [cantidad, tenantId, sucursal_id, producto]
          )

          if (rowCount === 0) {
            // Distinguir: ¿no existe el producto o no hay stock suficiente?
            const { rows } = await client.query(
              `SELECT stock FROM inventario_terminado
               WHERE tenant_id = $1 AND sucursal_id = $2 AND LOWER(producto) = LOWER($3)`,
              [tenantId, sucursal_id, producto]
            )
            if (rows.length === 0) {
              throw Object.assign(new Error(`Producto no encontrado en inventario de esta sucursal: ${producto}`), { status: 409 })
            }
            throw Object.assign(
              new Error(`Stock insuficiente: ${producto} (disponible: ${rows[0].stock}, solicitado: ${cantidad})`),
              { status: 409 }
            )
          }
        }
      }

      const { rows: itemsRows } = await client.query(
        'SELECT * FROM venta_items WHERE venta_id = $1 AND tenant_id = $2 ORDER BY id',
        [v.id, tenantId]
      )
      return { ...v, items: itemsRows }
    })

    res.status(201).json(venta)
    if (sucursal_id) checkStockTerminado(tenantId).catch(() => {})
  } catch (e) { next(e) }
})

// ── GET /api/ventas ───────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { limit = 200 } = req.query
    const { conds, params } = buildFiltros(req.query, req.tenantId)
    params.push(parseInt(limit))

    const { rows } = await query(`
      SELECT
        v.*, s.nombre AS sucursal_nombre,
        COALESCE(
          json_agg(
            json_build_object(
              'id', vi.id, 'producto', vi.producto, 'cantidad', vi.cantidad,
              'precio_unit', vi.precio_unit, 'subtotal', vi.subtotal
            ) ORDER BY vi.id
          ) FILTER (WHERE vi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM ventas v
      LEFT JOIN venta_items vi ON vi.venta_id = v.id AND vi.tenant_id = v.tenant_id
      LEFT JOIN sucursales s ON s.id = v.sucursal_id AND s.tenant_id = v.tenant_id
      WHERE ${conds.join(' AND ')}
      GROUP BY v.id, s.nombre
      ORDER BY v.fecha DESC, v.hora DESC
      LIMIT $${params.length}
    `, params)

    res.json(rows)
  } catch (e) { next(e) }
})

// ── GET /api/ventas/resumen ───────────────────────────────────────────────────
router.get('/resumen', async (req, res, next) => {
  try {
    const tenantId = req.tenantId
    // Sin fecha/desde/hasta explícitos, el resumen es del día actual en Nicaragua.
    const sinFiltroFecha = !req.query.fecha && !req.query.desde && !req.query.hasta
    const q = sinFiltroFecha ? { ...req.query, desde: undefined, hasta: undefined, fecha: undefined } : req.query
    const { conds: condsBase, params: paramsBase } = buildFiltros(q, tenantId)
    const fechaCond = sinFiltroFecha
      ? [...condsBase, "v.fecha = (NOW() AT TIME ZONE 'America/Managua')::date"]
      : condsBase
    const where = fechaCond.join(' AND ')

    const { rows: [resumen] } = await query(`
      SELECT
        COUNT(v.id)::INT                                          AS total_ventas,
        COALESCE(SUM(v.total), 0)                                 AS ingresos,
        COALESCE(AVG(v.total), 0)                                 AS ticket_promedio,
        COALESCE(SUM(CASE WHEN v.metodo_pago = 'efectivo'      THEN v.total ELSE 0 END), 0) AS efectivo,
        COALESCE(SUM(CASE WHEN v.metodo_pago = 'tarjeta'       THEN v.total ELSE 0 END), 0) AS tarjeta,
        COALESCE(SUM(CASE WHEN v.metodo_pago = 'transferencia' THEN v.total ELSE 0 END), 0) AS transferencia,
        COALESCE(SUM(CASE WHEN v.canal = 'tienda'    THEN v.total ELSE 0 END), 0) AS ing_tienda,
        COALESCE(SUM(CASE WHEN v.canal = 'whatsapp'  THEN v.total ELSE 0 END), 0) AS ing_whatsapp,
        COALESCE(SUM(CASE WHEN v.canal = 'encargo'   THEN v.total ELSE 0 END), 0) AS ing_encargo
      FROM ventas v
      WHERE ${where}
    `, paramsBase)

    const { rows: topProds } = await query(`
      SELECT vi.producto, SUM(vi.cantidad)::INT AS piezas, SUM(vi.subtotal) AS ingresos
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id AND v.tenant_id = vi.tenant_id
      WHERE ${where}
      GROUP BY vi.producto
      ORDER BY piezas DESC
      LIMIT 8
    `, paramsBase)

    const { rows: porSucursal } = await query(`
      SELECT COALESCE(s.nombre, 'Sin sucursal') AS sucursal, COALESCE(SUM(v.total), 0) AS total
      FROM ventas v
      LEFT JOIN sucursales s ON s.id = v.sucursal_id AND s.tenant_id = v.tenant_id
      WHERE ${where}
      GROUP BY COALESCE(s.nombre, 'Sin sucursal')
      ORDER BY total DESC
    `, paramsBase)

    res.json({
      ...resumen,
      top_productos: topProds,
      por_sucursal: porSucursal,
      fecha: req.query.fecha || (sinFiltroFecha ? new Date().toISOString().slice(0, 10) : null),
    })
  } catch (e) { next(e) }
})

// ── GET /api/ventas/cierre ────────────────────────────────────────────────────
router.get('/cierre', async (req, res, next) => {
  try {
    const { fecha } = req.query
    const tenantId  = req.tenantId
    const params    = fecha ? [tenantId, fecha] : [tenantId]
    const fechaCond = fecha ? 'v.fecha = $2' : "v.fecha = (NOW() AT TIME ZONE 'America/Managua')::date"

    const { rows: ventas } = await query(`
      SELECT v.id, v.hora, v.cliente, v.canal, v.metodo_pago, v.total,
        COALESCE(json_agg(json_build_object(
          'producto', vi.producto, 'cantidad', vi.cantidad, 'subtotal', vi.subtotal
        ) ORDER BY vi.id) FILTER (WHERE vi.id IS NOT NULL), '[]') AS items
      FROM ventas v
      LEFT JOIN venta_items vi ON vi.venta_id = v.id AND vi.tenant_id = v.tenant_id
      WHERE v.tenant_id = $1 AND ${fechaCond}
      GROUP BY v.id
      ORDER BY v.hora
    `, params)

    const total         = ventas.reduce((s, v) => s + parseFloat(v.total), 0)
    const efectivo      = ventas.filter(v => v.metodo_pago === 'efectivo').reduce((s, v) => s + parseFloat(v.total), 0)
    const tarjeta       = ventas.filter(v => v.metodo_pago === 'tarjeta').reduce((s, v) => s + parseFloat(v.total), 0)
    const transferencia = ventas.filter(v => v.metodo_pago === 'transferencia').reduce((s, v) => s + parseFloat(v.total), 0)

    res.json({
      fecha: fecha || new Date().toISOString().slice(0, 10),
      total_ventas: ventas.length,
      ingresos: total, efectivo, tarjeta, transferencia, ventas,
    })
  } catch (e) { next(e) }
})

// ── GET /api/ventas/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT v.*,
        COALESCE(json_agg(json_build_object(
          'id', vi.id, 'producto', vi.producto, 'cantidad', vi.cantidad,
          'precio_unit', vi.precio_unit, 'subtotal', vi.subtotal
        ) ORDER BY vi.id) FILTER (WHERE vi.id IS NOT NULL), '[]') AS items
      FROM ventas v
      LEFT JOIN venta_items vi ON vi.venta_id = v.id AND vi.tenant_id = v.tenant_id
      WHERE v.id = $1 AND v.tenant_id = $2
      GROUP BY v.id
    `, [req.params.id, req.tenantId])

    if (!rows.length) return res.status(404).json({ error: 'Venta no encontrada' })
    res.json(rows[0])
  } catch (e) { next(e) }
})

// ── DELETE /api/ventas/:id ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query(
      'DELETE FROM ventas WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Venta no encontrada' })
    res.json({ ok: true, id: req.params.id })
  } catch (e) { next(e) }
})

export default router
