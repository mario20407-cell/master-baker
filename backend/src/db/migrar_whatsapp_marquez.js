// backend/src/db/migrar_whatsapp_marquez.js
// Carga la configuración de WhatsApp de Marquéz (tenant por defecto) en
// tenant_whatsapp_config, a partir de las variables de entorno que ya
// existen en Railway (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID). No recibe
// secretos por argumento ni los imprime — se leen solo de env.
//
// Requiere DATABASE_URL en backend/.env apuntando al entorno correcto —
// es responsabilidad de quien lo corre confirmar que apunta al entorno
// deseado antes de ejecutar.
//
// Uso: node backend/src/db/migrar_whatsapp_marquez.js

import 'dotenv/config'
import pg from 'pg'

const { Client } = pg

const TENANT_ID_MARQUEZ = '00000000-0000-0000-0000-000000000001'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL no está configurado en backend/.env')
    process.exit(1)
  }
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_ID) {
    console.error('WHATSAPP_TOKEN y WHATSAPP_PHONE_ID deben estar configurados en el entorno.')
    process.exit(1)
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  try {
    const resultado = await client.query(
      `INSERT INTO tenant_whatsapp_config (tenant_id, phone_number_id, access_token)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id) DO NOTHING
       RETURNING id, tenant_id, phone_number_id`,
      [TENANT_ID_MARQUEZ, process.env.WHATSAPP_PHONE_ID, process.env.WHATSAPP_TOKEN]
    )

    if (resultado.rowCount === 0) {
      console.log(`Ya existe configuración de WhatsApp para el tenant ${TENANT_ID_MARQUEZ}. No se hizo ningún cambio.`)
    } else {
      console.log('Configuración de WhatsApp creada:')
      console.table(resultado.rows)
    }
  } catch (err) {
    console.error('Error:', err.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()
