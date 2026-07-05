import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../db/client.js'
import { requireAuth, requireRol } from '../middleware/authMiddleware.js'

const router = Router()

function generarToken(usuario) {
  return jwt.sign(
    {
      usuarioId: usuario.id,
      tenantId:  usuario.tenant_id,
      email:     usuario.email,
      nombre:    usuario.nombre,
      rol:       usuario.rol,
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  )
}

router.post('/login', async (req, res, next) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' })
  }
  try {
    const { rows } = await query(
      `SELECT u.*, t.nombre_negocio AS tenant_nombre, t.plan AS tenant_plan
       FROM usuarios u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1 AND u.tenant_id = $2 AND u.activo = true`,
      [email.toLowerCase().trim(), req.tenantId]
    )
    const usuario = rows[0]
    if (!usuario) return res.status(401).json({ error: 'Credenciales incorrectas' })
    const passwordValida = await bcrypt.compare(password, usuario.password_hash)
    if (!passwordValida) return res.status(401).json({ error: 'Credenciales incorrectas' })
    await query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1', [usuario.id])
    const token = generarToken(usuario)
    res.json({
      token,
      usuario: {
        id:            usuario.id,
        email:         usuario.email,
        nombre:        usuario.nombre,
        rol:           usuario.rol,
        tenantId:      usuario.tenant_id,
        tenantNombre:  usuario.tenant_nombre,
        tenantPlan:    usuario.tenant_plan,
      },
    })
  } catch (e) { next(e) }
})

router.post('/registrar', requireAuth, requireRol('admin'), async (req, res, next) => {
  const { email, password, nombre, rol = 'operario' } = req.body
  if (!email || !password || !nombre) {
    return res.status(400).json({ error: 'Email, contraseña y nombre son requeridos' })
  }
  if (!['admin', 'operario'].includes(rol)) return res.status(400).json({ error: 'Rol inválido' })
  if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
  try {
    const hash = await bcrypt.hash(password, 12)
    const { rows } = await query(
      `INSERT INTO usuarios (tenant_id, email, password_hash, nombre, rol)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, nombre, rol, creado_en`,
      [req.tenantId, email.toLowerCase().trim(), hash, nombre.trim(), rol]
    )
    res.status(201).json({ usuario: rows[0] })
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe una cuenta con ese email' })
    next(e)
  }
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.email, u.nombre, u.rol, u.ultimo_login,
              t.nombre_negocio AS tenant_nombre, t.plan AS tenant_plan
       FROM usuarios u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1 AND u.activo = true`,
      [req.usuarioId]
    )
    if (!rows[0]) return res.status(401).json({ error: 'Sesión inválida' })
    res.json({ usuario: rows[0] })
  } catch (e) { next(e) }
})

router.post('/logout', requireAuth, (req, res) => {
  res.json({ ok: true, mensaje: 'Sesion cerrada' })
})

export default router
