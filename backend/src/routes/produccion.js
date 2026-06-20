/**
 * /api/produccion — Ordenes de produccion con merma automatica de inventario
 * v3.1 — Filtra ingredientes indirectos, incluye tipo en query.
 */
import { Router } from 'express'
import { query, transaction } from '../db/client.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

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

    // Solo ingredientes directos — indirectos (gas, mano de obra) no tienen stock fisico
    const necesarios = receta.ingredientes
      .filter(ing => ing.tipo === 'directo')
      .map(ing => ({
        nombre: ing.nombre,
        unidad: ing.unidad,
        necesario: parseFloat((ing.cantidad * factor).toFixed(4)),
      }))

    const nombres = necesarios.map(n => n.nombre)
    const { rows: stocks } = await query(
      `SELECT nombre, existencia, unidad FROM inventario
       WHERE tenant_id = $1 AND nombre = ANY($2)`,
      [req.tenantId, nombres]
    )

    const stockMap = {}
    stocks.forEach(s => { stockMap[s.nombre] = parseFloat(s.existencia) })

    const resultado = necesarios.map(n => {
      const disponible = stockMap[n.nombre] ?? null
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

      // Solo ingredientes directos
      const necesarios = receta.ingredientes
        .filter(ing => ing.tipo === 'directo')
        .map(ing => ({
          nombre: ing.nombre,
          unidad: ing.unidad,
          necesario: parseFloat((ing.cantidad * factor).toFixed(4)),
        }))

      const nombres = necesarios.map(n => n.nombre)
      const { rows: stocks } = await client.query(
        `SELECT nombre, existencia FROM inventario
         WHERE tenant_id = $1 AND nombre = ANY($2)
         FOR UPDATE`,
        [req.tenantId, nombres]
      )

      const stockMap = {}
      stocks.forEach(s => { stockMap[s.nombre] = parseFloat(s.existencia) })

      const faltantes = necesarios.filter(n => {
        const disp = stockMap[n.nombre] ?? 0
        return disp < n.necesario
      })

      if (faltantes.length > 0 && !forzar) {
        const detalle = faltantes.map(f => ({
          nombre: f.nombre,
          necesario: f.necesario,
          disponible: stockMap[f.nombre] ?? 0,
          faltante: parseFloat((f.necesario - (stockMap[f.nombre] ?? 0)).toFixed(4)),
          unidad: f.unidad,
        }))
        throw Object.assign(new Error('Stock insuficiente'), { status: 409, faltantes: detalle })
      }

      for (const ing of necesarios) {
        await client.query(
          `UPDATE inventario
           SET existencia = GREATEST(0, existencia - $1), actualizado_en = NOW()
           WHERE tenant_id = $2 AND nombre = $3`,
          [ing.necesario, req.tenantId, ing.nombre]
        )
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