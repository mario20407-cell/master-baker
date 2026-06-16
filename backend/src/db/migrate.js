import 'dotenv/config'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { query } from './client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  console.log('🔧 Ejecutando migraciones...')
  try {
    const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
    await query(sql)
    console.log('✅ Esquema aplicado correctamente')
    console.log('   Tablas: productos, recetas, ingredientes, costeos, inventario, facturas, factura_items\n')
    process.exit(0)
  } catch (e) {
    console.error('❌ Error en migración:', e.message)
    process.exit(1)
  }
}

migrate()
