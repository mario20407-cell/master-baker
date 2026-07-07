import 'dotenv/config'
import { query } from './client.js'

async function run() {
  console.log('🚀 Iniciando migración de permisos granulares y bitácora de actividades...')
  try {
    // 1. Agregar columna permisos a usuarios si no existe
    console.log('1. Creando columna "permisos" en la tabla "usuarios"...')
    await query(`
      ALTER TABLE usuarios 
      ADD COLUMN IF NOT EXISTS permisos VARCHAR(50)[] 
      DEFAULT ARRAY['ver_recetas', 'registrar_ventas', 'ver_inventario', 'ver_produccion', 'ver_catalogo']
    `)

    // 2. Dar todos los permisos a los administradores existentes
    console.log('2. Asignando todos los permisos a los usuarios administradores existentes...')
    await query(`
      UPDATE usuarios 
      SET permisos = ARRAY[
        'ver_recetas', 'editar_recetas', 
        'ver_costeo', 'editar_costeo', 
        'ver_inventario', 'editar_inventario', 
        'ver_compras', 'registrar_compras', 
        'ver_ventas', 'registrar_ventas', 'eliminar_ventas', 
        'ver_produccion', 'gestionar_produccion',
        'ver_catalogo', 'editar_catalogo'
      ]
      WHERE rol = 'admin'
    `)

    // 3. Crear tabla de bitácora de actividades
    console.log('3. Creando tabla "bitacora_actividades"...')
    await query(`
      CREATE TABLE IF NOT EXISTS bitacora_actividades (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        usuario_nombre  VARCHAR(120) NOT NULL,
        usuario_email   VARCHAR(100) NOT NULL,
        modulo          VARCHAR(40) NOT NULL,
        accion          VARCHAR(60) NOT NULL,
        descripcion     TEXT NOT NULL,
        detalles        JSONB,
        ip_origen       VARCHAR(45),
        creado_en       TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    // 4. Crear índice optimizado
    console.log('4. Creando índices optimizados por inquilino y fecha...')
    await query(`
      CREATE INDEX IF NOT EXISTS idx_bitacora_tenant_creado 
      ON bitacora_actividades(tenant_id, creado_en DESC)
    `)

    console.log('✅ ¡Migración de base de datos completada exitosamente!')
    process.exit(0)
  } catch (err) {
    console.error('❌ Error durante la migración de base de datos:', err.message)
    process.exit(1)
  }
}

run()
