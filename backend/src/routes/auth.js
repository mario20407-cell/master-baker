import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { query, tenantQuery, transaction } from '../db/client.js'
import { requireAuth, requireRol } from '../middleware/authMiddleware.js'
import { registrarActividad } from '../services/bitacoraService.js'

const router = Router()

// El rate limit global (500/15min por IP) es demasiado permisivo para
// frenar fuerza bruta sobre una cuenta puntual — este limiter dedicado
// aplica solo a login y auto-registro.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Demasiados intentos. Esperá 15 minutos.' }
})

function generarToken(usuario) {
  return jwt.sign(
    {
      usuarioId:    usuario.id,
      tenantId:     usuario.tenant_id,
      email:        usuario.email,
      nombre:       usuario.nombre,
      rol:          usuario.rol,
      permisos:     usuario.permisos || [],
      // Revocación de sesiones (ver authMiddleware.js): requireAuth compara
      // este valor contra usuarios.token_version en cada request. Cambiar
      // contraseña o revocar sesiones sube ese número en la DB, y todo
      // token firmado con el número viejo deja de servir al instante.
      tokenVersion: usuario.token_version || 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  )
}

// POST /api/auth/registrar-negocio — Auto-registro público con código de invitación
// NOTA RLS: esta transacción se queda deliberadamente SIN tenantId — el
// tenant que se está creando aquí adentro no existe todavía antes del
// primer INSERT, así que no hay un tenantId previo que setear vía SET
// LOCAL ROLE. No es un hueco de seguridad: solo inserta filas nuevas bajo
// un tenant recién creado, no lee ni modifica datos de ningún otro tenant
// — no hay nada que RLS pudiera haber evitado que este flujo ya no evite
// por construcción (INSERT-only de datos propios). Pasa { sinTenant: true }
// explícitamente para dejar constancia de que es una excepción deliberada,
// no un olvido — transaction() exige uno de los dos (ver db/client.js).
router.post('/registrar-negocio', authLimiter, async (req, res, next) => {
  const { nombreNegocio, nombreAdmin, email, password, codigoInvitacion } = req.body

  // Fail-closed: si INVITATION_CODE no está configurado, se rechaza el
  // registro en vez de aceptar un valor por defecto hardcodeado (visible en
  // el código fuente, cualquiera con acceso al repo lo podía usar).
  if (!process.env.INVITATION_CODE) {
    console.error('[auth] INVITATION_CODE no configurado — rechazando auto-registro por seguridad.')
    return res.status(503).json({ error: 'Registro no disponible en este momento' })
  }
  const codigoValido = process.env.INVITATION_CODE.trim().toUpperCase()
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

      // Producto + receta de ejemplo, claramente marcados como "EJEMPLO".
      // El catálogo real queda vacío a propósito (cada negocio tiene sus
      // propios productos) — esto solo existe para que el socio fundador
      // vea el flujo completo (producto → receta → costeo) funcionando
      // antes de armar el suyo. Se puede borrar sin afectar nada más.
      const nombreProductoDemo = 'Pan Dulce (EJEMPLO — podés borrarlo)'
      await client.query(
        `INSERT INTO productos (tenant_id, nombre, precio, presentacion, categoria)
         VALUES ($1, $2, $3, 'unidad', $4)`,
        [nuevoTenant.id, nombreProductoDemo, 5.00, 'Ejemplo / Demo']
      )

      const ingredientesDemo = [
        { nombre: 'Harina de Trigo', cantidad: 2,    unidad: 'kg',     precio: 22.00 },
        { nombre: 'Azúcar',          cantidad: 0.5,  unidad: 'kg',     precio: 18.00 },
        { nombre: 'Manteca',         cantidad: 0.3,  unidad: 'kg',     precio: 45.00 },
        { nombre: 'Huevo',           cantidad: 4,    unidad: 'unidad', precio: 4.50  },
        { nombre: 'Levadura Seca',   cantidad: 30,   unidad: 'g',      precio: 0.15  },
        { nombre: 'Sal',             cantidad: 0.03, unidad: 'kg',     precio: 10.00 },
      ]
      const piezasDemo = 50
      const mermaDemo = 3
      const margenDemo = 57
      const costoDirectoDemo = ingredientesDemo.reduce((sum, i) => sum + i.cantidad * i.precio, 0)
      const costoIndirectoDemo = 0 // sin configuración de costeo todavía (gas/luz/mano en 0)
      const piezasEfectivas = piezasDemo * (1 - mermaDemo / 100)
      const costoUnitarioDemo = (costoDirectoDemo + costoIndirectoDemo) / piezasEfectivas
      const precioSugeridoDemo = costoUnitarioDemo / (1 - margenDemo / 100)

      const { rows: recetaDemoRows } = await client.query(
        `INSERT INTO recetas (tenant_id, producto, piezas, peso_por_pieza, merma_pct, notas, costo_directo, costo_indirecto, margen_aplicado, precio_sugerido)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          nuevoTenant.id, nombreProductoDemo, piezasDemo, 60, mermaDemo,
          'Receta de ejemplo para que veas cómo funciona el costeo. Podés editarla o borrarla cuando quieras — no afecta tus datos reales.',
          costoDirectoDemo, costoIndirectoDemo, margenDemo, precioSugeridoDemo
        ]
      )
      const recetaDemo = recetaDemoRows[0]

      const valsIngDemo = ingredientesDemo.map((_, idx) =>
        `($${idx * 7 + 1}, $${idx * 7 + 2}, $${idx * 7 + 3}, $${idx * 7 + 4}, $${idx * 7 + 5}, $${idx * 7 + 6}, $${idx * 7 + 7})`
      )
      const paramsIngDemo = ingredientesDemo.flatMap((ing, idx) => [
        nuevoTenant.id, recetaDemo.id, ing.nombre, ing.cantidad, ing.unidad, ing.precio, idx
      ])
      await client.query(
        `INSERT INTO ingredientes (tenant_id, receta_id, nombre, cantidad, unidad, precio, orden)
         VALUES ${valsIngDemo.join(', ')}`,
        paramsIngDemo
      )

      const hash = await bcrypt.hash(password, 12)
      const { rows: userRows } = await client.query(
        `INSERT INTO usuarios (tenant_id, email, password_hash, nombre, rol)
         VALUES ($1, $2, $3, $4, 'admin')
         RETURNING *`,
        [nuevoTenant.id, email.toLowerCase().trim(), hash, nombreAdmin.trim()]
      )
      const nuevoUsuario = userRows[0]

      return { nuevoTenant, nuevoUsuario }
    }, { sinTenant: true })

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

router.post('/login', authLimiter, async (req, res, next) => {
  const { email, password, negocio } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' })
  }
  try {
    const condicionNegocio = negocio ? 'AND t.slug = $2' : ''
    const params = negocio
      ? [email.toLowerCase().trim(), negocio.toLowerCase().trim()]
      : [email.toLowerCase().trim()]

    // NOTA RLS: query() sin tenant scope a propósito — en login todavía no
    // sabemos a qué tenant pertenece el usuario (puede ser el mismo email
    // en varios negocios, ver la lógica de "validos" más abajo). Es
    // justo lo que esta query está resolviendo, no hay tenantId previo
    // que setear.
    const { rows: candidatos } = await query(
      `SELECT u.*, t.nombre_negocio AS tenant_nombre, t.plan AS tenant_plan, t.slug AS tenant_slug
       FROM usuarios u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1 AND u.activo = true ${condicionNegocio}`,
      params
    )

    // Solo se consideran candidatos válidos los que además tienen la
    // contraseña correcta — así nunca revelamos en qué negocios existe
    // un email a alguien que todavía no probó la contraseña.
    const validos = []
    for (const c of candidatos) {
      if (await bcrypt.compare(password, c.password_hash)) validos.push(c)
    }

    if (validos.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    if (validos.length > 1) {
      return res.status(409).json({
        error: 'Ese email y contraseña son válidos en más de un negocio. Elegí con cuál querés ingresar.',
        necesitaNegocio: true,
        opciones: validos.map(v => ({ slug: v.tenant_slug, nombre: v.tenant_nombre }))
      })
    }

    const usuario = validos[0]
    // A partir de acá ya sabemos el tenant exacto (usuario.tenant_id,
    // resuelto arriba con email+password correctos) — se usa tenantQuery
    // con filtro explícito por tenant_id como defensa en profundidad real
    // vía RLS, en vez de confiar solo en que "id" es una PK única global.
    await tenantQuery(usuario.tenant_id, 'UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1 AND tenant_id = $2', [usuario.id, usuario.tenant_id])
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
    const { rows } = await tenantQuery(req.tenantId,
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
    const { rows } = await tenantQuery(req.tenantId,
      `SELECT u.id, u.email, u.nombre, u.rol, u.permisos, u.ultimo_login,
              t.nombre_negocio AS tenant_nombre, t.plan AS tenant_plan
       FROM usuarios u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1 AND u.tenant_id = $2 AND u.activo = true`,
      [req.usuarioId, req.tenantId]
    )
    if (!rows[0]) return res.status(401).json({ error: 'Sesión inválida' })
    res.json({ usuario: rows[0] })
  } catch (e) { next(e) }
})

// GET /api/auth/usuarios — Listar equipo (solo admin)
router.get('/usuarios', requireAuth, requireRol('admin'), async (req, res, next) => {
  try {
    const { rows } = await tenantQuery(req.tenantId,
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
    // Cambiar la contraseña también sube token_version — invalida de
    // inmediato cualquier sesión que ese usuario tuviera abierta con la
    // contraseña vieja (ver requireAuth en authMiddleware.js).
    const { rowCount } = await tenantQuery(req.tenantId,
      'UPDATE usuarios SET password_hash = $1, token_version = token_version + 1 WHERE id = $2 AND tenant_id = $3',
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
    const { rows } = await tenantQuery(req.tenantId, 'SELECT password_hash FROM usuarios WHERE id = $1 AND tenant_id = $2', [req.usuarioId, req.tenantId])
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' })

    const passwordValida = await bcrypt.compare(passwordActual, rows[0].password_hash)
    if (!passwordValida) return res.status(401).json({ error: 'Contraseña actual incorrecta' })

    const hash = await bcrypt.hash(passwordNueva, 12)
    // Sube token_version: la sesión actual sigue viva (su JWT ya tiene el
    // número nuevo desde el próximo login), pero cualquier otra sesión
    // abierta con la contraseña vieja queda invalidada de inmediato.
    await tenantQuery(req.tenantId, 'UPDATE usuarios SET password_hash = $1, token_version = token_version + 1 WHERE id = $2 AND tenant_id = $3', [hash, req.usuarioId, req.tenantId])

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
    const { rowCount } = await tenantQuery(req.tenantId,
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

// POST /api/auth/usuarios/:id/revocar-sesiones — invalida todas las sesiones
// activas de un colaborador sin tocar su contraseña (ej: sospecha de token
// filtrado, dispositivo perdido). Sube token_version — cualquier JWT emitido
// antes deja de servir en el próximo request, aunque no haya expirado.
router.post('/usuarios/:id/revocar-sesiones', requireAuth, requireRol('admin'), async (req, res, next) => {
  try {
    const { rows } = await tenantQuery(req.tenantId,
      'UPDATE usuarios SET token_version = token_version + 1 WHERE id = $1 AND tenant_id = $2 RETURNING id, email, nombre',
      [req.params.id, req.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' })

    await registrarActividad(req, {
      modulo: 'seguridad',
      accion: 'REVOCAR_SESIONES',
      descripcion: `Se revocaron todas las sesiones activas de "${rows[0].nombre}" (${rows[0].email})`,
      detalles: { usuario_afectado_id: rows[0].id, usuario_afectado_email: rows[0].email }
    })

    res.json({ ok: true, mensaje: `Sesiones de ${rows[0].nombre} revocadas — deberá iniciar sesión de nuevo` })
  } catch (e) { next(e) }
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
    const { rows } = await tenantQuery(req.tenantId,
      `UPDATE usuarios SET password_hash = $1, token_version = token_version + 1
       WHERE email = $2 AND tenant_id = $3 AND activo = true RETURNING id, email, nombre`,
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

// PUT /api/auth/negocio — Actualizar nombre de negocio y administrador
router.put('/negocio', requireAuth, requireRol('admin'), async (req, res, next) => {
  const { nombreNegocio, nombreAdmin, email } = req.body
  if (!nombreNegocio || !nombreAdmin || !email) {
    return res.status(400).json({ error: 'Todos los campos (nombreNegocio, nombreAdmin, email) son requeridos' })
  }
  try {
    const result = await transaction(async (client) => {
      // 1. Actualizar el tenant (nombre_negocio)
      await client.query(
        'UPDATE tenants SET nombre_negocio = $1, actualizado_en = NOW() WHERE id = $2',
        [nombreNegocio.trim(), req.tenantId]
      )

      // 2. Actualizar el usuario (nombre y email)
      const { rows } = await client.query(
        'UPDATE usuarios SET nombre = $1, email = $2 WHERE id = $3 AND tenant_id = $4 RETURNING id, email, nombre, rol',
        [nombreAdmin.trim(), email.toLowerCase().trim(), req.usuarioId, req.tenantId]
      )
      return rows[0]
    }, { tenantId: req.tenantId })

    await registrarActividad(req, {
      modulo: 'seguridad',
      accion: 'MODIFICAR_NEGOCIO_ADMIN',
      descripcion: 'Se actualizaron los datos del negocio a "' + nombreNegocio + '" y administrador a "' + nombreAdmin + '" (' + email + ')',
      detalles: { tenant_id: req.tenantId, usuario_id: req.usuarioId }
    })

    res.json({
      ok: true,
      usuario: {
        id: result.id,
        email: result.email,
        nombre: result.nombre,
        rol: result.rol,
        tenantId: req.tenantId,
        tenantNombre: nombreNegocio.trim()
      }
    })
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email' })
    }
    next(e)
  }
})

export default router
