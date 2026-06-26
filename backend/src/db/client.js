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

// Query normal sin tenant
export const query = (text, params) => pool.query(text, params)

// Query con RLS — inyecta tenant_id en la sesión de PostgreSQL
export const queryTenant = async (tenantId, text, params) => {
  const client = await pool.connect()
  try {
    await client.query(`SET LOCAL app.tenant_id = '${tenantId}'`)
    const result = await client.query(text, params)
    return result
  } finally {
    client.release()
  }
}

export const getClient = () => pool.connect()

export const transaction = async (fn) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
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

export default pool
