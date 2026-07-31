import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('Error inesperado en pool de PostgreSQL:', err.message)
})

export const query = (text, params) => pool.query(text, params)

export const getClient = () => pool.connect()

export const transaction = async (fn, opts = {}) => {
  const { tenantId } = opts
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (tenantId && process.env.RLS_TENANT_ENFORCE === 'true') await aplicarContextoTenant(client, tenantId)
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

// ── RLS real por tenant (ver decisiones/2026-07-29-rls-real-diferido.md) ──
//
// El rol de conexión de DATABASE_URL tiene BYPASSRLS (es el `postgres` de
// Supabase), así que las políticas RLS de schema.sql no aplican a él. Para
// que sí apliquen, cada operación que deba quedar acotada a un tenant tiene
// que correr con el rol restringido `app_tenant_scoped` (sin BYPASSRLS,
// creado por la migración no bloqueante en index.js) y con
// `app.tenant_id` seteado en el contexto de esa misma transacción.
//
// Por qué SET LOCAL dentro de un BEGIN/COMMIT real, y no SET ROLE a nivel
// de sesión: producción pasa por el Transaction Pooler de Supabase
// (Supavisor, puerto 6543 — confirmado 2026-07-31 vía DATABASE_URL en
// Railway). Ese pooler solo garantiza que una conexión física de Postgres
// se mantiene fija DURANTE una transacción explícita; fuera de una
// transacción, cada statement puede terminar en una conexión física
// distinta. SET ROLE/SET a nivel de sesión (sin LOCAL, sin BEGIN/COMMIT
// envolviendo) es por lo tanto poco confiable acá — el contexto podría no
// propagarse al siguiente statement, o peor, quedar pegado en una conexión
// física que Supavisor reutiliza para otro request sin resetearla. SET
// LOCAL sí es seguro: Postgres lo descarta automáticamente al terminar la
// transacción (COMMIT o ROLLBACK), sin importar qué conexión física haya
// sido, porque nunca sale de los límites de esa transacción.
//
// `set_config('app.tenant_id', $1, true)` usa bind parameter real (no hay
// interpolación de string, no hay superficie de inyección). El nombre del
// rol en `SET LOCAL ROLE` es un literal fijo del código, nunca un dato de
// usuario.
async function aplicarContextoTenant(client, tenantId) {
  await client.query('SET LOCAL ROLE app_tenant_scoped')
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [String(tenantId)])
}

// tenantQuery: equivalente a query(), pero corre dentro de su propia
// transacción de una sola consulta, con el rol restringido y el tenant_id
// seteado — para que las políticas RLS de la base apliquen de verdad. Es
// la versión "de lectura suelta" del mismo mecanismo que transaction(fn,
// { tenantId }) usa para bloques de escritura de varios pasos.
//
// Fail-closed por diseño: si no hay tenantId, esto NUNCA cae en silencio
// al rol privilegiado — lanza de inmediato, antes de abrir conexión.
// Distinto del riesgo de "fail-open" del diseño anterior (AsyncLocalStorage
// perdiendo contexto): acá no hay contexto ambiental que perder, tenantId
// es un parámetro explícito que cada caller tiene que pasar (normalmente
// req.tenantId, que tenantMiddleware/requireAuth ya garantizan que existe
// antes de llegar a cualquier ruta).
//
// Kill switch operativo: si RLS_TENANT_ENFORCE no es 'true' (default: no
// seteado, o cualquier otro valor), se comporta exactamente como query()
// de siempre — no toca el rol ni set_config. Permite desactivar esto en
// Railway sin revertir código, mientras se confirma que la migración del
// rol/GRANTs corrió bien en producción.
export const tenantQuery = async (tenantId, text, params) => {
  if (!tenantId) {
    throw new Error('tenantQuery: tenantId es requerido (fail-closed, no hay fallback a rol privilegiado)')
  }
  if (process.env.RLS_TENANT_ENFORCE !== 'true') {
    return pool.query(text, params)
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await aplicarContextoTenant(client, tenantId)
    const result = await client.query(text, params)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

export default pool
