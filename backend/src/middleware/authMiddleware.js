/**
 * authMiddleware.js
 *
 * DOS middlewares:
 *
 *   1. requireAuth — verifica que el request tenga un JWT válido.
 *      Adjunta req.usuarioId, req.tenantId, req.rol, req.email, req.nombre.
 *      IMPORTANTE: cuando existe JWT, su tenantId sobreescribe el que
 *      asignó tenantMiddleware — el JWT es la fuente de verdad de
 *      identidad, no el header ni el subdominio.
 *
 *   2. requireRol(rol) — verifica que el usuario autenticado tenga
 *      el rol requerido. SIEMPRE usar DESPUÉS de requireAuth.
 *
 * USO típico:
 *   import { requireAuth, requireRol } from '../middleware/authMiddleware.js'
 *
 *   // Solo autenticado (cualquier rol):
 *   router.get('/mis-datos', requireAuth, handler)
 *
 *   // Solo Admin:
 *   router.post('/registrar', requireAuth, requireRol('admin'), handler)
 *
 *   // Doble candado (rol Admin + PIN):
 *   router.put('/precio', requireAuth, requireRol('admin'), requireAdminPin, handler)
 */
import jwt from 'jsonwebtoken'

// ── requireAuth ───────────────────────────────────────────────────────────────
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Se requiere autenticación' })
  }

  const token = authHeader.slice(7) // quitar "Bearer "

  if (!process.env.JWT_SECRET) {
    console.error('[authMiddleware] JWT_SECRET no configurado en las variables de entorno')
    return res.status(500).json({ error: 'Error de configuración del servidor' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    // El JWT es la fuente de verdad — sobreescribimos lo que
    // tenantMiddleware haya asignado por header/subdominio/default.
    req.usuarioId = payload.usuarioId
    req.tenantId  = payload.tenantId
    req.rol       = payload.rol
    req.email     = payload.email
    req.nombre    = payload.nombre
    req.permisos  = payload.permisos || []

    next()
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesión expirada — inicia sesión de nuevo' })
    }
    return res.status(401).json({ error: 'Token inválido' })
  }
}

// ── requireRol ────────────────────────────────────────────────────────────────
export function requireRol(rolRequerido) {
  return function (req, res, next) {
    if (!req.rol) {
      // requireAuth no corrió antes — error de uso del middleware, no del cliente
      console.error('[authMiddleware] requireRol usado sin requireAuth antes')
      return res.status(500).json({ error: 'Error de configuración del servidor' })
    }

    if (req.rol !== rolRequerido) {
      return res.status(403).json({
        error: `Acción no permitida — se requiere rol "${rolRequerido}"`,
        rol_actual: req.rol,
      })
    }

    next()
  }
}

// ── requirePermission ──────────────────────────────────────────────────────────
export function requirePermission(permisoRequerido) {
  return function (req, res, next) {
    if (!req.rol) {
      console.error('[authMiddleware] requirePermission usado sin requireAuth antes')
      return res.status(500).json({ error: 'Error de configuración del servidor' })
    }

    // Los administradores siempre tienen permiso para todo
    if (req.rol === 'admin') return next()

    if (!req.permisos || !req.permisos.includes(permisoRequerido)) {
      return res.status(403).json({
        error: `Acceso denegado — Se requiere el permiso: "${permisoRequerido}"`
      })
    }

    next()
  }
}