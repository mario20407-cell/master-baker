import 'dotenv/config'
import { query } from './client.js'

async function run() {
  console.log('🚀 Iniciando corrección de constraint check en auditoria_precios...')
  try {
    // 1. Eliminar la constraint anterior si existe
    console.log('1. Eliminando constraint vieja de "metodo"...')
    await query(`
      ALTER TABLE auditoria_precios 
      DROP CONSTRAINT IF EXISTS auditoria_precios_metodo_check
    `)

    // 2. Agregar la nueva constraint que incluye 'compras'
    console.log('2. Creando nueva constraint con soporte para "compras"...')
    await query(`
      ALTER TABLE auditoria_precios 
      ADD CONSTRAINT auditoria_precios_metodo_check 
      CHECK (metodo IN ('individual', 'masivo_lista', 'masivo_porcentaje', 'compras'))
    `)

    console.log('✅ ¡Corrección completada exitosamente!')
    process.exit(0)
  } catch (err) {
    console.error('❌ Error durante la corrección:', err.message)
    process.exit(1)
  }
}

run()
