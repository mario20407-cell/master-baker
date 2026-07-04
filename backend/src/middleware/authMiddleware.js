import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Se requiere autenticacion' })
  }
  const token = authHeader.slice(7)
  const secret = process.env.JWT_SECRET || 'cambia_esto_por_un_secreto_largo'
  try {
    const payload = jwt.verify(token, secret)
    req.usuarioId = payload.usuarioId
    req.tenantId  = payload.tenantId
    req.rol       = payload.rol
    req.email     = payload.email
    req.nombre    = payload.nombre
    next()
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesion expirada' })
    }
    return res.status(401).json({ error: 'Token invalido' })
  }
}

export function requireRol(rolRequerido) {
  return function (req, res, next) {
    if (!req.rol) {
      return res.status(500).json({ error: 'Error de configuracion del servidor' })
    }
    if (req.rol !== rolRequerido) {
      return res.status(403).json({ error: 'Accion no permitida', rol_actual: req.rol })
    }
    next()
  }
}
