import { Router } from 'express'
import express from 'express'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { query } from '../db/client.js'

const router = Router()

// Este router se monta antes del CORS restrictivo global (ver index.js),
// porque el panel de estado vive fuera de los dominios de la app (masterbaker.store /
// vercel). El acceso sigue protegido por el token, no por el origen.
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'x-admin-token, Content-Type')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// Este router se monta antes del express.json() global — necesita el suyo
// propio para poder leer el body de POST /reset-password.
router.use(express.json())

// Todas las rutas de este router requieren el token de administrador.
// Se configura como variable de entorno ADMIN_TOKEN en Railway — nunca
// se guarda en el código ni lo ingresa el asistente.
router.use((req, res, next) => {
  const token = process.env.ADMIN_TOKEN
  if (!token) {
    return res.status(503).json({ error: 'ADMIN_TOKEN no configurado en el servidor' })
  }
  if (req.headers['x-admin-token'] !== token) {
    return res.status(401).json({ error: 'Token de administrador inválido' })
  }
  next()
})

// GET /api/admin/estado-fundadores
// Reporte de estado por tenant: quién se registró, último login,
// cuántos productos reales (fuera del producto de EJEMPLO), ventas
// registradas, ítems de inventario, consumo de tokens de IA y tiempo en
// pantalla (total histórico y últimos 7 días). Pensado para el panel de
// seguimiento de socios fundadores.
router.get('/estado-fundadores', async (req, res, next) => {
  try {
    const { rows: tenants } = await query(
      'SELECT id, slug, nombre_negocio, creado_en FROM tenants ORDER BY creado_en'
    )

    const out = []
    for (const t of tenants) {
      const [admin, productos, ventas, inventario, tokensTotal, tokens7d, tiempoTotal, tiempo7d] = await Promise.all([
        query(
          "SELECT email, ultimo_login FROM usuarios WHERE tenant_id = $1 AND rol = 'admin' ORDER BY creado_en LIMIT 1",
          [t.id]
        ),
        query(
          "SELECT count(*) FROM productos WHERE tenant_id = $1 AND nombre NOT ILIKE '%EJEMPLO%'",
          [t.id]
        ),
        query('SELECT count(*) FROM ventas WHERE tenant_id = $1', [t.id]),
        query('SELECT count(*) FROM inventario WHERE tenant_id = $1', [t.id]),
        query(
          'SELECT COALESCE(SUM(input_tokens + output_tokens), 0) AS total FROM ai_usage_log WHERE tenant_id = $1',
          [t.id]
        ),
        query(
          "SELECT COALESCE(SUM(input_tokens + output_tokens), 0) AS total FROM ai_usage_log WHERE tenant_id = $1 AND creado_en >= NOW() - INTERVAL '7 days'",
          [t.id]
        ),
        // Cada heartbeat representa ~1 minuto activo (ver actividad.js) —
        // contar filas equivale directamente a minutos en pantalla.
        query(
          'SELECT count(*) FROM actividad_heartbeats WHERE tenant_id = $1',
          [t.id]
        ),
        query(
          "SELECT count(*) FROM actividad_heartbeats WHERE tenant_id = $1 AND creado_en >= NOW() - INTERVAL '7 days'",
          [t.id]
        )
      ])

      out.push({
        negocio: t.nombre_negocio,
        slug: t.slug,
        admin_email: admin.rows[0]?.email || null,
        ultimo_login: admin.rows[0]?.ultimo_login || null,
        productos_reales: parseInt(productos.rows[0].count, 10),
        ventas: parseInt(ventas.rows[0].count, 10),
        items_inventario: parseInt(inventario.rows[0].count, 10),
        tokens_total: parseInt(tokensTotal.rows[0].total, 10),
        tokens_7d: parseInt(tokens7d.rows[0].total, 10),
        tiempo_pantalla_min_total: parseInt(tiempoTotal.rows[0].count, 10),
        tiempo_pantalla_min_7d: parseInt(tiempo7d.rows[0].count, 10),
        creado_en: t.creado_en
      })
    }

    res.json(out)
  } catch (e) { next(e) }
})

// POST /api/admin/reset-password
// Genera una contraseña temporal nueva. Acepta `slug` (resetea al primer
// admin de ese negocio) o `email` (resetea esa cuenta puntual, sin importar
// el negocio o rol). La devuelve una sola vez. Pensado para cuando un socio
// fundador olvida su contraseña y no hay flujo de autoservicio.
router.post('/reset-password', async (req, res, next) => {
  try {
    const { slug, email } = req.body || {}
    if (!slug && !email) return res.status(400).json({ error: 'Falta slug del negocio o email' })

    let negocioNombre = null
    let objetivo

    if (email) {
      const { rows } = await query(
        'SELECT id, email, activo FROM usuarios WHERE email = $1 ORDER BY creado_en LIMIT 1',
        [email.toLowerCase().trim()]
      )
      objetivo = rows[0]
      if (!objetivo) return res.status(404).json({ error: 'No existe un usuario con ese email' })
    } else {
      const { rows: tenants } = await query(
        'SELECT id, nombre_negocio FROM tenants WHERE slug = $1',
        [slug]
      )
      if (!tenants[0]) return res.status(404).json({ error: 'Negocio no encontrado' })
      negocioNombre = tenants[0].nombre_negocio

      const { rows: admins } = await query(
        "SELECT id, email, activo FROM usuarios WHERE tenant_id = $1 AND rol = 'admin' ORDER BY creado_en LIMIT 1",
        [tenants[0].id]
      )
      objetivo = admins[0]
      if (!objetivo) return res.status(404).json({ error: 'Este negocio no tiene un usuario admin' })
    }

    // Contraseña temporal legible — evita caracteres ambiguos (0/O, 1/l/I).
    const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let nuevaPassword = ''
    for (let i = 0; i < 10; i++) nuevaPassword += alfabeto[crypto.randomInt(alfabeto.length)]

    const hash = await bcrypt.hash(nuevaPassword, 12)
    // Reactiva la cuenta por si quedó desactivada — de lo contrario el login
    // (que filtra WHERE activo = true) rechazaría la contraseña nueva aunque
    // el hash sea correcto.
    await query('UPDATE usuarios SET password_hash = $1, activo = true WHERE id = $2', [hash, objetivo.id])

    res.json({
      negocio: negocioNombre,
      email: objetivo.email,
      nueva_password: nuevaPassword,
      estaba_activo: objetivo.activo
    })
  } catch (e) { next(e) }
})

export default router
