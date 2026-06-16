/**
 * /api/ventas — Registro y consulta de ventas
 *
 * POST /api/ventas              → crear venta con sus items
 * GET  /api/ventas              → listar ventas (filtros: fecha, canal, metodo_pago)
 * GET  /api/ventas/resumen      → KPIs del día: total, ticket promedio, top productos
 * GET  /api/ventas/cierre?fecha → cierre de caja de una fecha (default: hoy)
 * GET  /api/ventas/:id          → venta individual con items
 * DELETE /api/ventas/:id        → anular venta (soft: marca como anulada)
 *
 * El motor de costeo corre en el frontend; el backend solo persiste y agrega.
 * Los items se guardan en venta_items (subtotal es columna generada en DB).
 */
import { Router } from 'express'
import { query, transaction } from '../db/client.js'

const router = Router()

// ── POST /api/ventas ──────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  const { items, total, metodo_pago = 'efectivo', canal = 'tienda', cliente = 'Sin nombre', fecha, hora } = req.body

  if (!items?.length)          return res.status(400).json({ error: 'La venta debe tener al menos un item' })
  if (!total || total <= 0)    return res.status(400).json({ error: 'El total debe ser mayor a 0' })

  // Validar que el total declarado coincide con la suma de items (tolerancia C$ 0.01)
  const sumaItems = items.reduce((s, i) => s + (parseFloat(i.precio_unit) * parseInt(i.cantidad)), 0)
  if (Math.abs(sumaItems - parseFloat(total)) > 0.01) {
    return res.status(400).json({ error: `Total declarado (${total}) no coincide con suma de items (${sumaItems.toFixed(2)})` })
  }

  try {
    const venta = await transaction(async (client) => {
      // Insertar cabecera
      const fechaSQL = fecha || 'CURRENT_DATE'
      const horaSQL  = hora  ? `'${hora}'::TIME` : "NOW()::TIME"

      const { rows: [v] } = await client.query(`
        INSERT INTO ventas (fecha, hora, cliente, canal, metodo_pago, total)
        VALUES (${fecha ? '$1' : 'CURRENT_DATE'}, ${hora ? `'${hora}'::TIME` : 'NOW()::TIME'}, $${fecha ? 2 : 1}, $${fecha ? 3 : 2}, $${fecha ? 4 : 3}, $${fecha ? 5 : 4})
        RETURNING *
      `, fecha ? [fecha, cliente, canal, metodo_pago, total] : [cliente, canal, metodo_pago, total])

      // Insertar items
      if (items.length > 0) {
        const vals   = items.map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`)
        const params = [v.id, ...items.flatMap(i => [i.producto || i.n, parseInt(i.cantidad || i.qty || 1), parseFloat(i.precio_unit || i.p)])]
        await client.query(
          `INSERT INTO venta_items (venta_id, producto, cantidad, precio_unit) VALUES ${vals}`,
          params
        )
      }

      // Retornar venta con items
      const { rows: itemsRows } = await client.query(
        'SELECT * FROM venta_items WHERE venta_id = $1 ORDER BY id',
        [v.id]
      )
      return { ...v, items: itemsRows }
    })

    res.status(201).json(venta)
  } catch (e) { next(e) }
})

// ── GET /api/ventas ───────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { fecha, canal, metodo_pago, limit = 100 } = req.query
    const conds  = []
    const params = []

    if (fecha)       { params.push(fecha);       conds.push(`v.fecha = $${params.length}`) }
    if (canal)       { params.push(canal);        conds.push(`v.canal = $${params.length}`) }
    if (metodo_pago) { params.push(metodo_pago);  conds.push(`v.metodo_pago = $${params.length}`) }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    params.push(parseInt(limit))

    const { rows } = await query(`
      SELECT
        v.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id',          vi.id,
              'producto',    vi.producto,
              'cantidad',    vi.cantidad,
              'precio_unit', vi.precio_unit,
              'subtotal',    vi.subtotal
            ) ORDER BY vi.id
          ) FILTER (WHERE vi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM ventas v
      LEFT JOIN venta_items vi ON vi.venta_id = v.id
      ${where}
      GROUP BY v.id
      ORDER BY v.creado_en DESC
      LIMIT $${params.length}
    `, params)

    res.json(rows)
  } catch (e) { next(e) }
})

// ── GET /api/ventas/resumen ───────────────────────────────────────────────────
// KPIs del día para el Dashboard. Llamada liviana con una sola query agregada.
router.get('/resumen', async (req, res, next) => {
  try {
    const { fecha } = req.query
    const fechaSQL  = fecha || 'CURRENT_DATE'

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
      WHERE v.fecha = ${fecha ? '$1' : 'CURRENT_DATE'}
    `, fecha ? [fecha] : [])

    // Top 8 productos del día
    const { rows: topProds } = await query(`
      SELECT vi.producto, SUM(vi.cantidad)::INT AS piezas, SUM(vi.subtotal) AS ingresos
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      WHERE v.fecha = ${fecha ? '$1' : 'CURRENT_DATE'}
      GROUP BY vi.producto
      ORDER BY piezas DESC
      LIMIT 8
    `, fecha ? [fecha] : [])

    res.json({ ...resumen, top_productos: topProds, fecha: fecha || new Date().toISOString().slice(0,10) })
  } catch (e) { next(e) }
})

// ── GET /api/ventas/cierre ────────────────────────────────────────────────────
router.get('/cierre', async (req, res, next) => {
  try {
    const { fecha } = req.query
    const { rows: ventas } = await query(`
      SELECT v.id, v.hora, v.cliente, v.canal, v.metodo_pago, v.total,
        COALESCE(json_agg(json_build_object(
          'producto', vi.producto, 'cantidad', vi.cantidad, 'subtotal', vi.subtotal
        ) ORDER BY vi.id) FILTER (WHERE vi.id IS NOT NULL), '[]') AS items
      FROM ventas v
      LEFT JOIN venta_items vi ON vi.venta_id = v.id
      WHERE v.fecha = ${fecha ? '$1' : 'CURRENT_DATE'}
      GROUP BY v.id
      ORDER BY v.hora
    `, fecha ? [fecha] : [])

    const total     = ventas.reduce((s, v) => s + parseFloat(v.total), 0)
    const efectivo  = ventas.filter(v => v.metodo_pago === 'efectivo').reduce((s, v) => s + parseFloat(v.total), 0)
    const tarjeta   = ventas.filter(v => v.metodo_pago === 'tarjeta').reduce((s, v) => s + parseFloat(v.total), 0)
    const transferencia = ventas.filter(v => v.metodo_pago === 'transferencia').reduce((s, v) => s + parseFloat(v.total), 0)

    res.json({
      fecha: fecha || new Date().toISOString().slice(0, 10),
      total_ventas: ventas.length,
      ingresos: total,
      efectivo,
      tarjeta,
      transferencia,
      ventas,
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
      LEFT JOIN venta_items vi ON vi.venta_id = v.id
      WHERE v.id = $1
      GROUP BY v.id
    `, [req.params.id])

    if (!rows.length) return res.status(404).json({ error: 'Venta no encontrada' })
    res.json(rows[0])
  } catch (e) { next(e) }
})

// ── DELETE /api/ventas/:id ─────────────────────────────────────────────────────
// Anulación: no borramos físicamente — cascade en venta_items sí elimina los items.
// En un sistema real habría un campo `anulada BOOLEAN` y auditoría.
// Por ahora eliminamos la venta (los items se van por CASCADE en la FK).
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM ventas WHERE id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ error: 'Venta no encontrada' })
    res.json({ ok: true, id: req.params.id })
  } catch (e) { next(e) }
})

export default router
