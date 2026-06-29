import 'dotenv/config'
import { query } from '../src/db/client.js'

async function main() {
  console.log('Ejecutando migración de usuarios...')

  await query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id      UUID NOT NULL REFERENCES tenants(id),
      email          VARCHAR(120) NOT NULL,
      password_hash  TEXT,
      nombre         VARCHAR(120) NOT NULL,
      rol            VARCHAR(30) NOT NULL DEFAULT 'operario',
      activo         BOOLEAN DEFAULT true,
      ultimo_login   TIMESTAMPTZ,
      creado_en      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (tenant_id, email)
    )
  `)
  console.log('1. Tabla usuarios: OK')

  await query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_hash TEXT`)
  console.log('2. Columna password_hash: OK')

  await query(`
    INSERT INTO usuarios (tenant_id, email, nombre, rol)
    VALUES ('00000000-0000-0000-0000-000000000001', 'admin@marquez.com', 'Administrador', 'admin')
    ON CONFLICT (tenant_id, email) DO NOTHING
  `)
  console.log('3. Usuario admin: OK')

  process.exit(0)
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
