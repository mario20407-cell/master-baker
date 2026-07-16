import { Router } from 'express'
import { query } from '../db/client.js'

const router = Router()

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
// registradas e ítems de inventario. Pensado para el panel de
// seguimiento de socios fundadores.
router.get('/estado-fundadores', async (req, res, next) => {
  try {
    const { rows: tenants } = await query(
      'SELECT id, slug, nombre_negocio, creado_en FROM tenants ORDER BY creado_en'
    )

    const out = []
    for (const t of tenants) {
      const [admin, productos, ventas, inventario] = await Promise.all([
        query(
          "SELECT email, ultimo_login FROM usuarios WHERE tenant_id = $1 AND rol = 'admin' ORDER BY creado_en LIMIT 1",
          [t.id]
        ),
        query(
          "SELECT count(*) FROM productos WHERE tenant_id = $1 AND nombre NOT ILIKE '%EJEMPLO%'",
          [t.id]
        ),
        query('SELECT count(*) FROM ventas WHERE tenant_id = $1', [t.id]),
        query('SELECT count(*) FROM inventario WHERE tenant_id = $1', [t.id])
      ])

      out.push({
        negocio: t.nombre_negocio,
        slug: t.slug,
        admin_email: admin.rows[0]?.email || null,
        ultimo_login: admin.rows[0]?.ultimo_login || null,
        productos_reales: parseInt(productos.rows[0].count, 10),
        ventas: parseInt(ventas.rows[0].count, 10),
        items_inventario: parseInt(inventario.rows[0].count, 10),
        creado_en: t.creado_en
      })
    }

    res.json(out)
  } catch (e) { next(e) }
})

export default router
