/**
 * /api/produccion — Ordenes de produccion con merma automatica de inventario
 * v3.2 — Busqueda de ingredientes insensible a tildes y mayusculas.
 */
import { Router } from 'express'
import { query, transaction } from '../db/client.js'
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js'
import { distribuirLote } from '../services/produccionService.js'
import { norm } from '../lib/normalizarTexto.js'

const router = Router()

// Conversión de unidades a una unidad base común (g para masa, ml para volumen, unidad para conteo)
const CONVERSION_MASA = {
  g: 1,
  gr: 1,
  gramo: 1,
  gramos: 1,
  kg: 1000,
  kilo: 1000,
  kilos: 1000,
  kilogramo: 1000,
  kilogramos: 1000,
  lb: 453.59237,
  lbs: 453.59237,
  libra: 453.59237,
  libras: 453.59237,
  oz: 28.349523,
  onza: 28.349523,
  onzas: 28.349523
}

const CONVERSION_VOLUMEN = {
  ml: 1,
  mililitro: 1,
  mililitros: 1,
  l: 1000,
  L: 1000,
  litro: 1000,
  litros: 1000,
  gl: 3785.41178,
  galon: 3785.41178,
  galones: 3785.41178
}

function normalizarUnidad(u) {
  const clean = String(u || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (CONVERSION_MASA[clean]) return { tipo: 'masa', factor: CONVERSION_MASA[clean] }
  if (CONVERSION_VOLUMEN[clean]) return { tipo: 'volumen', factor: CONVERSION_VOLUMEN[clean] }
  return { tipo: 'unidad', factor: 1 }
}

function convertir(cantidad, unidadOrigen, unidadDestino) {
  const orig = normalizarUnidad(unidadOrigen)
  const dest = normalizarUnidad(unidadDestino)

  if (orig.tipo === dest.tipo) {
    const cantidadEnBase = cantidad * orig.factor
    return cantidadEnBase / dest.factor
  }
  return cantidad
}

// ── GET /api/produccion/verificar?producto=X&piezas=Y ─────────────────────
router.get('/verificar', requireAuth, requirePermission('ver_produccion'), async (req, res, next) => {
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
      const disponibleOriginal = stock ? stock.existencia : null
      const unidadOriginal = stock ? stock.unidad : null

      // Convertir disponible en inventario a la unidad de la receta para poder comparar numéricamente
      const disponible = stock !== null ? convertir(stock.existencia, stock.unidad, n.unidad) : null
      const suficiente = disponible !== null && disponible >= n.necesario
      const faltante = disponible !== null ? Math.max(0, n.necesario - disponible) : n.necesario

      return { 
        ...n, 
        disponible, 
        suficiente, 
        faltante, 
        sin_inventario: disponible === null,
        disponible_original: disponibleOriginal,
        unidad_original: unidadOriginal
      }
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
router.get('/', requireAuth, requirePermission('ver_produccion'), async (req, res, next) => {
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
router.post('/', requireAuth, requirePermission('gestionar_produccion'), async (req, res, next) => {
  const { producto, piezas, notas = '', forzar = false, distribuciones } = req.body
  if (!producto || !piezas) return res.status(400).json({ error: 'producto y piezas son requeridos' })
  const cantidadPiezas = parseInt(piezas)
  if (cantidadPiezas < 1) return res.status(400).json({ error: 'piezas debe ser mayor a 0' })
  if (distribuciones !== undefined) {
    if (!Array.isArray(distribuciones) || distribuciones.some(d => !d.sucursal_id || !(Number(d.cantidad) > 0)))
      return res.status(400).json({ error: 'distribuciones debe ser un array de { sucursal_id, cantidad > 0 }' })
  }

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

      // Traer inventario completo y matchear por nombre normalizado (incluyendo unidad)
      const { rows: stocks } = await client.query(
        `SELECT id, nombre, existencia, unidad FROM inventario WHERE tenant_id = $1 FOR UPDATE`,
        [req.tenantId]
      )

      const stockMap = {}
      stocks.forEach(s => { stockMap[norm(s.nombre)] = { id: s.id, nombre: s.nombre, existencia: parseFloat(s.existencia), unidad: s.unidad } })

      const faltantes = necesarios.filter(n => {
        const stock = stockMap[norm(n.nombre)]
        if (!stock) return true
        const disponible = convertir(stock.existencia, stock.unidad, n.unidad)
        return disponible < n.necesario
      })

      if (faltantes.length > 0 && !forzar) {
        const detalle = faltantes.map(f => {
          const stock = stockMap[norm(f.nombre)]
          const disponible = stock ? convertir(stock.existencia, stock.unidad, f.unidad) : 0
          return {
            nombre: f.nombre,
            necesario: f.necesario,
            disponible: disponible,
            faltante: parseFloat((f.necesario - disponible).toFixed(4)),
            unidad: f.unidad,
          }
        })
        throw Object.assign(new Error('Stock insuficiente'), { status: 409, faltantes: detalle })
      }

      // Descontar solo los que tienen registro en inventario
      for (const ing of necesarios) {
        const stock = stockMap[norm(ing.nombre)]
        if (stock) {
          // Convertir la cantidad necesaria (en unidad de receta) a la unidad de inventario para restar
          const necesarioEnUnidadInventario = convertir(ing.necesario, ing.unidad, stock.unidad)
          await client.query(
            `UPDATE inventario SET existencia = GREATEST(0, existencia - $1), actualizado_en = NOW()
             WHERE id = $2 AND tenant_id = $3`,
            [necesarioEnUnidadInventario, stock.id, req.tenantId]
          )
        }
      }

      const { rows: [orden] } = await client.query(
        `INSERT INTO ordenes_produccion (tenant_id, producto, piezas, notas, creado_por, estado)
         VALUES ($1, $2, $3, $4, $5, 'completada')
         RETURNING *`,
        [req.tenantId, producto, cantidadPiezas, notas, req.usuarioId]
      )

      // Crear automáticamente el lote correspondiente a esta producción, vinculado a la orden
      const { rows: [lote] } = await client.query(
        `INSERT INTO lotes (tenant_id, producto, cantidad, unidad, costo_total, notas, orden_produccion_id)
         VALUES ($1,$2,$3,'unidad',0,$4,$5) RETURNING *`,
        [req.tenantId, producto, cantidadPiezas, notas || null, orden.id]
      )
      const { rows: [caja] } = await client.query(
        `INSERT INTO caja_produccion (tenant_id, lote_id, cantidad_inicial, precio_unitario, fecha)
         VALUES ($1,$2,$3,0,CURRENT_DATE) RETURNING *`,
        [req.tenantId, lote.id, cantidadPiezas]
      )

      let distribucionesResult = null
      if (Array.isArray(distribuciones) && distribuciones.length > 0) {
        distribucionesResult = await distribuirLote(client, req.tenantId, lote, distribuciones)
      }

      return {
        orden,
        ingredientes_descontados: necesarios,
        lote: { ...lote, caja },
        distribuciones: distribucionesResult,
      }
    })

    res.status(201).json(result)
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: e.message })
    if (e.status === 409) return res.status(409).json({ error: e.message, faltantes: e.faltantes })
    if (e.status === 400) return res.status(400).json({ error: e.message })
    next(e)
  }
})

export default router

// ── GET /api/produccion/stock-hoy ─────────────────────────────────────────
// Cruza produccion del dia vs ventas del dia por producto
// Devuelve: producido, vendido, disponible estimado
router.get('/stock-hoy', requireAuth, requirePermission('ver_produccion'), async (req, res, next) => {
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
