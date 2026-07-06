/**
 * tenantMiddleware.js
 *
 * Resuelve qué tenant (panadería) está haciendo la petición y lo
 * adjunta a req.tenantId para que todas las rutas lo usen al filtrar.
 *
 * ESTADO ACTUAL (sin login todavía):
 *   - Si no hay sistema de auth, usamos el tenant fijo de Marquéz.
 *   - El middleware ya soporta resolver por header x-tenant-id o por
 *     subdominio, así que cuando se agregue login no hay que tocar
 *     ninguna ruta — solo cambiar cómo se llena req.tenantId aquí.
 *
 * USO en index.js:
 *   import { tenantMiddleware } from './middleware/tenantMiddleware.js'
 *   app.use(tenantMiddleware)
 *
 * USO en cualquier ruta:
 *   const { tenantId } = req
 *   query('SELECT * FROM productos WHERE tenant_id = $1', [tenantId])
 */
import { query } from '../db/client.js'

// Tenant por defecto — Marquéz. Mismo UUID fijo que en la migración SQL.
export const TENANT_MARQUEZ_ID = '00000000-0000-0000-0000-000000000001'

// Cache simple en memoria para no consultar la tabla tenants en cada request.
// Se invalida solo al reiniciar el proceso — aceptable para el volumen actual.
const tenantCache = new Map()

async function resolverPorSlug(slug) {
  if (tenantCache.has(slug)) return tenantCache.get(slug)

  const { rows } = await query('SELECT * FROM tenants WHERE slug = $1 AND activo = true', [slug])
  const tenant = rows[0] || null
  if (tenant) tenantCache.set(slug, tenant)
  return tenant
}

export async function tenantMiddleware(req, res, next) {
  try {
    // Prioridad de resolución (de más a menos específico):
    // 1. Header explícito x-tenant-id — útil para testing y futuras integraciones
    // 2. Subdominio — cuando se habiliten subdominios por cliente (marquez.masterbaker.app)
    // 3. Default — Marquéz, mientras solo exista un tenant operando

    const headerTenantId = req.headers['x-tenant-id']
    if (headerTenantId) {
      req.tenantId = headerTenantId
      return next()
    }

    const host = req.headers.host || ''
    const subdominio = host.split('.')[0]
    const esSubdominioValido = subdominio && !['www', 'localhost', 'master-baker-production'].includes(subdominio) && !host.startsWith('localhost')

    if (esSubdominioValido) {
      const tenant = await resolverPorSlug(subdominio)
      if (tenant) {
        req.tenantId = tenant.id
        req.tenant = tenant
        return next()
      }
    }

    // Default: Marquéz — válido mientras no haya más tenants ni login
    req.tenantId = TENANT_MARQUEZ_ID
    next()
  } catch (e) {
    // Si algo falla resolviendo el tenant, no tumbamos el request:
    // caemos al tenant default para no romper producción.
    req.tenantId = TENANT_MARQUEZ_ID
    next()
  }
}
