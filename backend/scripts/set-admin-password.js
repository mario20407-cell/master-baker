/**
 * Uso: node scripts/set-admin-password.js
 * Setea el password_hash del admin en la DB de producción.
 * Requiere DATABASE_URL en el entorno.
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { query } from '../src/db/client.js'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const EMAIL     = 'admin@marquez.com'
const PASSWORD  = process.env.ADMIN_PASSWORD || 'Marquez1988!'

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12)

  // Upsert: crea el usuario si no existe, actualiza el hash si ya existe
  const { rows } = await query(
    `INSERT INTO usuarios (tenant_id, email, password_hash, nombre, rol)
     VALUES ($1, $2, $3, 'Administrador', 'admin')
     ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, email, rol`,
    [TENANT_ID, EMAIL, hash]
  )

  console.log('Password actualizado para:', rows[0])
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
