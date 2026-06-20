/**
 * /api/produccion — Ordenes de produccion con merma automatica de inventario
 * v3.2 — Busqueda de ingredientes insensible a tildes y mayusculas.
 */
import { Router } from 'express'
import { query, transaction } from '../db/client.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

// Normaliza texto: quita tildes y pasa a minusculas para comparacion flexible
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

// ── GET /api/produccion/verificar?producto=X&piezas=Y ─────────────────────
router.get('/verificar', requireAuth, async (req, res, next) => {
  const { producto, piezas } = req.query
  if (!producto || !piezas) return res.status(400).json({ error: 'producto y piezas son requeridos' })
  const cantidadPiezas = parseInt(piezas)
  if (cantidadPiezas < 1) return res.status(400).json({ error: 'piezas debe ser mayor a 0' })

  try {
    const { rows: recetas } = await query(
      `SELECT r.piezas AS piezas_base, r.merma_pct,
              json_agg(json_build_object(
                'nombre', i.nombre, 'cantidad', i.cantidad, 'unidad', i.unidad, 'tipo', i.tipo
              )) AS ingredientes
       FROM recetas r
       JOIN ingredientes i ON i.receta_id = r.id
       WHERE r.producto = $1 AND r.tenant_id = $2
       GROUP BY r.id`,
      [producto, req.tenantId]
    )
    if (!recetas.length) return res.status(404).json({ error: 'No existe receta para este producto' })

    const receta = recetas[0]
    const factor = cantidadPiezas / receta.piezas_base

    // Solo ingredientes directos
    const necesarios = receta.ingredientes
      .filter(ing => ing.tipo === 'directo')
      .map(ing => ({
        nombre: ing.nombre,
        unidad: ing.unidad,
        necesario: parseFloat((ing.cantidad * factor).toFixed(4)),
      }))

    // Traer todo el inventario del tenant y matchear por nombre normalizado
    const { rows: stocks } = await query(
      `SELECT nombre, existencia, unidad FROM inventario WHERE tenant_id = $1`,
      [req.tenantId]
    )

    // Map por nombre normalizado
    const stockMap = {}
    stocks.forEach(s => { stockMap[norm(s.nombre)] = { existencia: parseFloat(s.existencia), unidad: s.unidad, nombre: s.nombre } })

    const resultado = necesarios.map(n => {
      const stock = stockMap[norm(n.nombre)] ?? null
      const disponible = stock ? stock.existencia : null
      const suficiente = disponible !== null && disponible >= n.necesario
      const faltante = disponible !== null ? Math.max(0, n.necesario - disponible) : n.necesario
      return { ...n, disponible, suficiente, faltante, sin_inventario: disponible === null }
    })

    const puedeProducir = resultado.every(r => r.suficiente)

    res.json({
      producto,
      piezas: cantidadPiezas,
      piezas_base: receta.piezas_base,
      merma_pct: receta.merma_pct,
      puede_producir: puedeProducir,
      ingredientes: resultado,
    })
  } catch (e) { next(e) }
})

// ── GET /api/produccion ────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT op.*, u.nombre AS creado_por_nombre
       FROM ordenes_produccion op
       LEFT JOIN usuarios u ON u.id = op.creado_por
       WHERE op.tenant_id = $1
       ORDER BY op.creado_en DESC
       LIMIT 100`,
      [req.tenantId]
    )
    res.json(rows)
  } catch (e) { next(e) }
})

// ── POST /api/produccion ───────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res, next) => {
  const { producto, piezas, notas = '', forzar = false } = req.body
  if (!producto || !piezas) return res.status(400).json({ error: 'producto y piezas son requeridos' })
  const cantidadPiezas = parseInt(piezas)
  if (cantidadPiezas < 1) return res.status(400).json({ error: 'piezas debe ser mayor a 0' })

  try {
    const result = await transaction(async (client) => {
      const { rows: recetas } = await client.query(
        `SELECT r.id, r.piezas AS piezas_base, r.merma_pct,
                json_agg(json_build_object(
                  'nombre', i.nombre, 'cantidad', i.cantidad, 'unidad', i.unidad, 'tipo', i.tipo
                )) AS ingredientes
         FROM recetas r
         JOIN ingredientes i ON i.receta_id = r.id
         WHERE r.producto = $1 AND r.tenant_id = $2
         GROUP BY r.id`,
        [producto, req.tenantId]
      )
      if (!recetas.length) throw Object.assign(new Error('No existe receta para este producto'), { status: 404 })

      const receta = recetas[0]
      const factor = cantidadPiezas / receta.piezas_base

      const necesarios = receta.ingredientes
        .filter(ing => ing.tipo === 'directo')
        .map(ing => ({
          nombre: ing.nombre,
          unidad: ing.unidad,
          necesario: parseFloat((ing.cantidad * factor).toFixed(4)),
        }))

      // Traer inventario completo y matchear por nombre normalizado
      const { rows: stocks } = await client.query(
        `SELECT id, nombre, existencia FROM inventario WHERE tenant_id = $1 FOR UPDATE`,
        [req.tenantId]
      )

      const stockMap = {}
      stocks.forEach(s => { stockMap[norm(s.nombre)] = { id: s.id, nombre: s.nombre, existencia: parseFloat(s.existencia) } })

      const faltantes = necesarios.filter(n => {
        const stock = stockMap[norm(n.nombre)]
        return !stock || stock.existencia < n.necesario
      })

      if (faltantes.length > 0 && !forzar) {
        const detalle = faltantes.map(f => {
          const stock = stockMap[norm(f.nombre)]
          return {
            nombre: f.nombre,
            necesario: f.necesario,
            disponible: stock ? stock.existencia : 0,
            faltante: parseFloat((f.necesario - (stock ? stock.existencia : 0)).toFixed(4)),
            unidad: f.unidad,
          }
        })
        throw Object.assign(new Error('Stock insuficiente'), { status: 409, faltantes: detalle })
      }

      // Descontar solo los que tienen registro en inventario
      for (const ing of necesarios) {
        const stock = stockMap[norm(ing.nombre)]
        if (stock) {
          await client.query(
            `UPDATE inventario SET existencia = GREATEST(0, existencia - $1), actualizado_en = NOW()
             WHERE id = $2 AND tenant_id = $3`,
            [ing.necesario, stock.id, req.tenantId]
          )
        }
      }

      const { rows: [orden] } = await client.query(
        `INSERT INTO ordenes_produccion (tenant_id, producto, piezas, notas, creado_por, estado)
         VALUES ($1, $2, $3, $4, $5, 'completada')
         RETURNING *`,
        [req.tenantId, producto, cantidadPiezas, notas, req.usuarioId]
      )

      return { orden, ingredientes_descontados: necesarios }
    })

    res.status(201).json(result)
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: e.message })
    if (e.status === 409) return res.status(409).json({ error: e.message, faltantes: e.faltantes })
    next(e)
  }
})

export default router

// ── GET /api/produccion/stock-hoy ─────────────────────────────────────────
// Cruza produccion del dia vs ventas del dia por producto
// Devuelve: producido, vendido, disponible estimado
router.get('/stock-hoy', requireAuth, async (req, res, next) => {
  try {
    const fecha = req.query.fecha || new Date().toISOString().slice(0, 10)

    // Produccion del dia
    const { rows: producido } = await query(
      `SELECT producto, SUM(piezas)::INT AS producido
       FROM ordenes_produccion
       WHERE tenant_id = $1 AND DATE(creado_en) = $2 AND estado = 'completada'
       GROUP BY producto`,
      [req.tenantId, fecha]
    )

    // Ventas del dia por producto
    const { rows: vendido } = await query(
      `SELECT vi.producto, SUM(vi.cantidad)::INT AS vendido
       FROM venta_items vi
       JOIN ventas v ON v.id = vi.venta_id
       WHERE v.tenant_id = $1 AND v.fecha = $2
       GROUP BY vi.producto`,
      [req.tenantId, fecha]
    )

    const vendidoMap = {}
    vendido.forEach(v => { vendidoMap[norm(v.producto)] = parseInt(v.vendido) })

    const stock = producido.map(p => ({
      producto: p.producto,
      producido: p.producido,
      vendido: vendidoMap[norm(p.producto)] || 0,
      disponible: p.producido - (vendidoMap[norm(p.producto)] || 0),
    }))

    res.json({ fecha, stock })
  } catch (e) { next(e) }
})
