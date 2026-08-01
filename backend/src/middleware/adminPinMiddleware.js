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
 * v3 — agrega adminPinLimiter (auditoría técnica 2026-08-01, hallazgo
 * MEDIO): el PIN es de mínimo 4 dígitos (10,000 combinaciones) y antes
 * solo estaba protegido por el rate limit global (500 req/15min por IP),
 * insuficiente para frenar fuerza bruta dentro de la ventana de 8h de un
 * JWT de admin válido. adminPinLimiter cuenta solo los intentos fallidos
 * (skipSuccessfulRequests) por tenant — así un admin legítimo haciendo
 * muchos cambios de precio reales nunca se ve afectado.
 *
 * Requiere que requireAuth (y por lo tanto req.tenantId) ya haya corrido
 * antes en la cadena de middlewares del router.
 *
 * USO en una ruta:
 *   import { requireAdminPin, adminPinLimiter } from '../middleware/adminPinMiddleware.js'
 *   router.put('/:id', requireRol('admin'), adminPinLimiter, requireAdminPin, async (req, res) => { ... })
 */
import bcrypt from 'bcrypt'
import rateLimit from 'express-rate-limit'
import { tenantQuery } from '../db/client.js'

export const adminPinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.tenantId || req.ip,
  message: { error: 'Demasiados intentos de PIN incorrectos. Esperá 15 minutos.' },
})

export async function requireAdminPin(req, res, next) {
  try {
    const { rows } = await tenantQuery(req.tenantId,
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
