/**
 * adminPinMiddleware.js
 *
 * Protege rutas de escritura sensibles (cambios de precio) con un PIN
 * simple — no es un sistema de login, es un candado de "solo Admin"
 * mientras Master Baker tiene un único operador (Mario).
 *
 * El PIN vive en la variable de entorno ADMIN_PIN del backend. Nunca
 * se expone al frontend ni se guarda en el navegador — cada request
 * de edición de precio debe incluirlo en el header x-admin-pin.
 *
 * USO en una ruta:
 *   import { requireAdminPin } from '../middleware/adminPinMiddleware.js'
 *   router.put('/:id', requireAdminPin, async (req, res) => { ... })
 *
 * Cuando más adelante exista login real con roles, este middleware se
 * reemplaza por un chequeo de req.user.rol === 'admin' — el resto del
 * código (las rutas) no necesita cambiar porque sigue siendo un
 * middleware que corta el flujo si no pasa la validación.
 */

export function requireAdminPin(req, res, next) {
  const pinConfigurado = process.env.ADMIN_PIN

  if (!pinConfigurado) {
    console.error('⚠️  ADMIN_PIN no configurado en el servidor')
    return res.status(500).json({ error: 'Error de configuración de seguridad en el servidor (ADMIN_PIN faltante)' })
  }

  const pinRecibido = req.headers['x-admin-pin']

  if (!pinRecibido) {
    return res.status(401).json({ error: 'Se requiere PIN de administrador para esta acción' })
  }

  if (pinRecibido !== pinConfigurado) {
    return res.status(403).json({ error: 'PIN de administrador incorrecto' })
  }

  next()
}
