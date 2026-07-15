import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { query, transaction } from '../db/client.js'
import { requireAuth, requireRol } from '../middleware/authMiddleware.js'
import { registrarActividad } from '../services/bitacoraService.js'

const router = Router()

function generarToken(usuario) {
  return jwt.sign(
    {
      usuarioId: usuario.id,
      tenantId:  usuario.tenant_id,
      email:     usuario.email,
      nombre:    usuario.nombre,
      rol:       usuario.rol,
      permisos:  usuario.permisos || [],
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  )
}

// POST /api/auth/registrar-negocio — Auto-registro público con código de invitación
router.post('/registrar-negocio', async (req, res, next) => {
  const { nombreNegocio, nombreAdmin, email, password, codigoInvitacion } = req.body

  const codigoValido = (process.env.INVITATION_CODE || 'FUNDADOR2026').trim().toUpperCase()
  if (!codigoInvitacion || codigoInvitacion.trim().toUpperCase() !== codigoValido) {
    return res.status(403).json({ error: 'Código de invitación inválido' })
  }

  if (!nombreNegocio || !nombreAdmin || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' })
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
  }

  try {
    const { rows: emailExists } = await query('SELECT id FROM usuarios WHERE email = $1', [email.toLowerCase().trim()])
    if (emailExists.length) {
      return res.status(409).json({ error: 'El correo ya está registrado' })
    }

    let slug = nombreNegocio.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    if (!slug) slug = 'panaderia'

    const result = await transaction(async (client) => {
      const { rows: slugCheck } = await client.query('SELECT id FROM tenants WHERE slug = $1', [slug])
      if (slugCheck.length) {
        slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`
      }

      const { rows: tenantRows } = await client.query(
        `INSERT INTO tenants (slug, nombre_negocio, plan, trial_vence_en)
         VALUES ($1, $2, 'trial', NOW() + INTERVAL '30 days')
         RETURNING *`,
        [slug, nombreNegocio.trim()]
      )
      const nuevoTenant = tenantRows[0]

      // Insertar insumos básicos plantales/básicos por defecto
      const insumosBasicos = [
        { nombre: 'Harina de Trigo', unidad: 'kg', costo: 22.00 },
        { nombre: 'Azúcar', unidad: 'kg', costo: 18.00 },
        { nombre: 'Sal', unidad: 'kg', costo: 10.00 },
        { nombre: 'Levadura Seca', unidad: 'g', costo: 0.15 },
        { nombre: 'Manteca', unidad: 'kg', costo: 45.00 },
        { nombre: 'Huevo', unidad: 'unidad', costo: 4.50 },
        { nombre: 'Leche', unidad: 'l', costo: 32.00 },
        { nombre: 'Mantequilla', unidad: 'kg', costo: 120.00 },
        { nombre: 'Polvo de hornear', unidad: 'g', costo: 0.25 }
      ]

      for (const ins of insumosBasicos) {
        await client.query(
          `INSERT INTO inventario (tenant_id, nombre, existencia, unidad, consumo_diario, punto_reposicion, costo_unitario)
           VALUES ($1, $2, 0, $3, 0, 0, $4)`,
          [nuevoTenant.id, ins.nombre, ins.unidad, ins.costo]
        )
      }

      const hash = await bcrypt.hash(password, 12)
      const { rows: userRows } = await client.query(
        `INSERT INTO usuarios (tenant_id, email, password_hash, nombre, rol)
         VALUES ($1, $2, $3, $4, 'admin')
         RETURNING *`,
        [nuevoTenant.id, email.toLowerCase().trim(), hash, nombreAdmin.trim()]
      )
      const nuevoUsuario = userRows[0]

      return { nuevoTenant, nuevoUsuario }
    })

    const token = generarToken(result.nuevoUsuario)
    res.status(201).json({
      token,
      usuario: {
        id:            result.nuevoUsuario.id,
        email:         result.nuevoUsuario.email,
        nombre:        result.nuevoUsuario.nombre,
        rol:           result.nuevoUsuario.rol,
        tenantId:      result.nuevoTenant.id,
        tenantNombre:  result.nuevoTenant.nombre_negocio,
        tenantPlan:    result.nuevoTenant.plan,
      }
    })
  } catch (e) {
    next(e)
  }
})

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
       WHERE u.email = $1 AND u.activo = true`,
      [email.toLowerCase().trim()]
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
        permisos:      usuario.permisos || [],
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
      `SELECT u.id, u.email, u.nombre, u.rol, u.permisos, u.ultimo_login,
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

// GET /api/auth/usuarios — Listar equipo (solo admin)
router.get('/usuarios', requireAuth, requireRol('admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, email, nombre, rol, activo, creado_en, ultimo_login FROM usuarios WHERE tenant_id = $1 ORDER BY nombre',
      [req.tenantId]
    )
    res.json(rows)
  } catch (e) { next(e) }
})

// PUT /api/auth/usuarios/:id/password — Restablecer contraseña por administrador
router.put('/usuarios/:id/password', requireAuth, requireRol('admin'), async (req, res, next) => {
  const { password } = req.body
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
  }
  try {
    const hash = await bcrypt.hash(password, 12)
    const { rowCount } = await query(
      'UPDATE usuarios SET password_hash = $1 WHERE id = $2 AND tenant_id = $3',
      [hash, req.params.id, req.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json({ ok: true, mensaje: 'Contraseña restablecida exitosamente' })
  } catch (e) { next(e) }
})

// PUT /api/auth/password — Autoservicio: el usuario cambia su propia contraseña
router.put('/password', requireAuth, async (req, res, next) => {
  const { passwordActual, passwordNueva } = req.body
  if (!passwordActual || !passwordNueva) {
    return res.status(400).json({ error: 'passwordActual y passwordNueva son requeridas' })
  }
  if (passwordNueva.length < 8) {
    return res.status(400).json({ error: 'La contraseña nueva debe tener al menos 8 caracteres' })
  }
  try {
    const { rows } = await query('SELECT password_hash FROM usuarios WHERE id = $1', [req.usuarioId])
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' })

    const passwordValida = await bcrypt.compare(passwordActual, rows[0].password_hash)
    if (!passwordValida) return res.status(401).json({ error: 'Contraseña actual incorrecta' })

    const hash = await bcrypt.hash(passwordNueva, 12)
    await query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hash, req.usuarioId])

    await registrarActividad(req, {
      modulo: 'seguridad',
      accion: 'CAMBIO_PASSWORD_PROPIO',
      descripcion: `El usuario "${req.nombre}" (${req.email}) cambió su propia contraseña`,
      detalles: { usuario_id: req.usuarioId }
    })

    res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente' })
  } catch (e) { next(e) }
})

// DELETE /api/auth/usuarios/:id — Eliminar colaborador (solo admin)
router.delete('/usuarios/:id', requireAuth, requireRol('admin'), async (req, res, next) => {
  if (req.params.id === req.usuarioId) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' })
  }
  try {
    const { rowCount } = await query(
      'DELETE FROM usuarios WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json({ ok: true, mensaje: 'Colaborador eliminado' })
  } catch (e) { next(e) }
})

router.post('/logout', requireAuth, (req, res) => {
  res.json({ ok: true, mensaje: 'Sesion cerrada' })
})

// POST /api/auth/reset-password — reset de contraseña con PIN de admin
router.post('/reset-password', requireAuth, requireRol('admin'), async (req, res, next) => {
  const { email, nueva_password } = req.body
  if (!email || !nueva_password) {
    return res.status(400).json({ error: 'Email y nueva contraseña son requeridos' })
  }
  if (nueva_password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
  }
  try {
    const hash = await bcrypt.hash(nueva_password, 12)
    const { rows } = await query(
      `UPDATE usuarios SET password_hash = $1 WHERE email = $2 AND tenant_id = $3 AND activo = true RETURNING id, email, nombre`,
      [hash, email.toLowerCase().trim(), req.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' })

    await registrarActividad(req, {
      modulo: 'seguridad',
      accion: 'RESET_PASSWORD_ADMIN',
      descripcion: `Contraseña restablecida por admin para el usuario "${rows[0].nombre}" (${rows[0].email})`,
      detalles: { usuario_afectado_id: rows[0].id, usuario_afectado_email: rows[0].email }
    })

    res.json({ ok: true, mensaje: `Contraseña actualizada para ${rows[0].nombre}` })
  } catch (e) { next(e) }
})

export default router
