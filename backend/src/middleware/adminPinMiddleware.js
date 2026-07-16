/**
 * adminPinMiddleware.js
 *
 * Protege rutas de escritura sensibles (cambios de precio) con un PIN
 * simple — no es un sistema de login, es un candado extra de "solo Admin"
 * antes de aplicar un cambio de precio.
 *
 * v2 — el PIN ya NO es una única variable de entorno global compartida
 * por todo el backend. Cada tenant (negocio) tiene su propio PIN,
 * guardado como hash bcrypt en tenants.admin_pin_hash. Se configura y
 * se cambia desde /api/admin-pin (ver routes/adminPin.js), accesible
 * para el admin de cada negocio en "Mi Cuenta".
 *
 * Requiere que requireAuth (y por lo tanto req.tenantId) ya haya corrido
 * antes en la cadena de middlewares del router.
 *
 * USO en una ruta:
 *   import { requireAdminPin } from '../middleware/adminPinMiddleware.js'
 *   router.put('/:id', requireAdminPin, async (req, res) => { ... })
 */
import bcrypt from 'bcrypt'
import { query } from '../db/client.js'

export async function requireAdminPin(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT admin_pin_hash FROM tenants WHERE id = $1',
      [req.tenantId]
    )
    const pinHash = rows[0]?.admin_pin_hash

    if (!pinHash) {
      return res.status(400).json({
        error: 'Tu negocio todavía no configuró un PIN de administrador. Configuralo en Mi Cuenta antes de editar precios.',
        pin_no_configurado: true,
      })
    }

    const pinRecibido = req.headers['x-admin-pin']
    if (!pinRecibido) {
      return res.status(401).json({ error: 'Se requiere PIN de administrador para esta acción' })
    }

    const valido = await bcrypt.compare(String(pinRecibido), pinHash)
    if (!valido) {
      return res.status(403).json({ error: 'PIN de administrador incorrecto' })
    }

    next()
  } catch (e) { next(e) }
}
