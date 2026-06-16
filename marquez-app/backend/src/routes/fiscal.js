/**
 * /api/fiscal — Configuración fiscal DGI
 *
 * Tabla: config_fiscal (fila única, id = 1).
 * GET  /api/fiscal       → devuelve la configuración actual
 * PUT  /api/fiscal       → upsert (crea o actualiza)
 * GET  /api/fiscal/prorrateo?cuota=300&produccion=1350
 *                        → calcula prorrateo sin persistir
 */
import { Router } from 'express'
import { query } from '../db/client.js'

const router = Router()

// ── GET /api/fiscal ───────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM config_fiscal WHERE id = 1')
    if (!rows.length) return res.json({ configurado: false })
    res.json(rows[0])
  } catch (e) { next(e) }
})

// ── PUT /api/fiscal ───────────────────────────────────────────────────────────
router.put('/', async (req, res, next) => {
  const {
    regimen,
    cuota_fija = 0,
    ir_anual = 0,
    iva_aplica = 'Ninguno',
    produccion_mensual,
    nombre_negocio = 'Master Baker',
    ruc = '',
  } = req.body

  // Validaciones
  if (!regimen || !['cuota_fija', 'reg_general'].includes(regimen)) {
    return res.status(400).json({ error: 'regimen debe ser cuota_fija o reg_general' })
  }
  if (regimen === 'cuota_fija' && (!cuota_fija || parseFloat(cuota_fija) <= 0)) {
    return res.status(400).json({ error: 'cuota_fija debe ser mayor a 0 para este régimen' })
  }
  if (!produccion_mensual || parseInt(produccion_mensual) < 1) {
    return res.status(400).json({ error: 'produccion_mensual debe ser al menos 1 unidad' })
  }

  try {
    const { rows } = await query(`
      UPDATE config_fiscal SET
        regimen            = $1,
        cuota_fija         = $2,
        ir_anual           = $3,
        iva_aplica         = $4,
        produccion_mensual = $5,
        nombre_negocio     = $6,
        ruc                = $7,
        configurado        = true,
        actualizado_en     = NOW()
      WHERE id = 1
      RETURNING *
    `, [regimen, cuota_fija, ir_anual, iva_aplica, produccion_mensual, nombre_negocio, ruc])

    res.json(rows[0])
  } catch (e) { next(e) }
})

// ── GET /api/fiscal/prorrateo ─────────────────────────────────────────────────
// Util sin estado: calcula el prorrateo a partir de query params.
// Úsalo desde el frontend para preview en tiempo real sin guardar.
router.get('/prorrateo', async (req, res) => {
  const cuota      = parseFloat(req.query.cuota) || 0
  const produccion = parseInt(req.query.produccion) || 1
  const costo_base = parseFloat(req.query.costo_base) || 0

  const prorrateo_unitario     = cuota / produccion
  const costo_con_fiscal       = costo_base + prorrateo_unitario
  const precio_min_sin_fiscal  = costo_base > 0 ? costo_base / 0.43 : 0
  const precio_min_con_fiscal  = costo_con_fiscal > 0 ? costo_con_fiscal / 0.43 : 0

  res.json({
    cuota,
    produccion,
    prorrateo_unitario,
    costo_base,
    costo_con_fiscal,
    precio_min_sin_fiscal,
    precio_min_con_fiscal,
  })
})

export default router
