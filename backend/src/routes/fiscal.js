/**
 * /api/fiscal — Configuración fiscal DGI
 * v2.8 — Multi-tenant: la PK de config_fiscal ahora es tenant_id,
 * cada panadería tiene su propia fila en lugar de una global con id=1.
 */
import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import { query } from '../db/client.js'

const router = Router()
router.use(requireAuth)

// ── GET /api/fiscal ───────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM config_fiscal WHERE tenant_id = $1', [req.tenantId])
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
    // Upsert por tenant_id: inserta si no existe, actualiza si ya existe.
    const { rows } = await query(`
      INSERT INTO config_fiscal
        (tenant_id, regimen, cuota_fija, ir_anual, iva_aplica, produccion_mensual, nombre_negocio, ruc, configurado, actualizado_en)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW())
      ON CONFLICT (tenant_id) DO UPDATE SET
        regimen            = EXCLUDED.regimen,
        cuota_fija         = EXCLUDED.cuota_fija,
        ir_anual           = EXCLUDED.ir_anual,
        iva_aplica         = EXCLUDED.iva_aplica,
        produccion_mensual = EXCLUDED.produccion_mensual,
        nombre_negocio     = EXCLUDED.nombre_negocio,
        ruc                = EXCLUDED.ruc,
        configurado        = true,
        actualizado_en     = NOW()
      RETURNING *
    `, [req.tenantId, regimen, cuota_fija, ir_anual, iva_aplica, produccion_mensual, nombre_negocio, ruc])

    res.json(rows[0])
  } catch (e) { next(e) }
})

// ── GET /api/fiscal/prorrateo ─────────────────────────────────────────────────
// Util sin estado — no necesita tenant_id porque no toca la DB.
router.get('/prorrateo', async (req, res) => {
  const cuota      = parseFloat(req.query.cuota) || 0
  const produccion = parseInt(req.query.produccion) || 1
  const costo_base = parseFloat(req.query.costo_base) || 0

  const prorrateo_unitario     = cuota / produccion
  const costo_con_fiscal       = costo_base + prorrateo_unitario
  const precio_min_sin_fiscal  = costo_base > 0 ? costo_base / 0.43 : 0
  const precio_min_con_fiscal  = costo_con_fiscal > 0 ? costo_con_fiscal / 0.43 : 0

  res.json({
    cuota, produccion, prorrateo_unitario, costo_base,
    costo_con_fiscal, precio_min_sin_fiscal, precio_min_con_fiscal,
  })
})

export default router
