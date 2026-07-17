import { Router } from 'express'
import bcrypt from 'bcrypt'
import { query } from '../db/client.js'
import { requireAuth, requireRol } from '../middleware/authMiddleware.js'

// PIN de administrador por negocio (no una variable de entorno global —
// ver adminPinMiddleware.js). Solo el admin del tenant puede verlo/cambiarlo.
const router = Router()
router.use(requireAuth, requireRol('admin'))

// GET /api/admin-pin/estado — indica si el negocio ya configuró un PIN,
// sin revelar el valor.
router.get('/estado', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT admin_pin_hash FROM tenants WHERE id = $1', [req.tenantId])
    res.json({ configurado: !!rows[0]?.admin_pin_hash })
  } catch (e) { next(e) }
})

// PUT /api/admin-pin — configura o cambia el PIN del negocio.
// body: { pin_actual (requerido solo si ya hay uno configurado), pin_nuevo }
router.put('/', async (req, res, next) => {
  const { pin_actual, pin_nuevo } = req.body || {}
  if (!pin_nuevo || String(pin_nuevo).trim().length < 4) {
    return res.status(400).json({ error: 'El PIN nuevo debe tener al menos 4 caracteres' })
  }
  try {
    const { rows } = await query('SELECT admin_pin_hash FROM tenants WHERE id = $1', [req.tenantId])
    const hashActual = rows[0]?.admin_pin_hash

    if (hashActual) {
      if (!pin_actual) {
        return res.status(400).json({ error: 'Ingresá el PIN actual para poder cambiarlo' })
      }
      const valido = await bcrypt.compare(String(pin_actual), hashActual)
      if (!valido) {
        return res.status(403).json({ error: 'El PIN actual no es correcto' })
      }
    }

    const hashNuevo = await bcrypt.hash(String(pin_nuevo).trim(), 12)
    await query('UPDATE tenants SET admin_pin_hash = $1 WHERE id = $2', [hashNuevo, req.tenantId])
    res.json({ ok: true })
  } catch (e) { next(e) }
})

export default router
