// backend/src/db/cifrar_access_token_existente.js
// Backfill: cifra en producción los access_token de tenant_whatsapp_config
// que todavía estén en texto plano (sin el prefijo v1: de cifrado.js). No
// recibe secretos por argumento ni los imprime — nunca loguea valores de
// access_token, solo la cantidad de filas afectadas.
//
// Requiere DATABASE_URL y WHATSAPP_TOKEN_ENCRYPTION_KEY en backend/.env
// apuntando al entorno correcto — es responsabilidad de quien lo corre
// confirmar que apunta al entorno deseado antes de ejecutar.
//
// Uso: node backend/src/db/cifrar_access_token_existente.js

import 'dotenv/config'
import pg from 'pg'
import { cifrar } from '../utils/cifrado.js'

const { Client } = pg

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL no está configurado en backend/.env')
    process.exit(1)
  }
  if (!process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY) {
    console.error('WHATSAPP_TOKEN_ENCRYPTION_KEY no está configurado en el entorno.')
    process.exit(1)
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  try {
    const { rows: pendientes } = await client.query(
      `SELECT id, access_token FROM tenant_whatsapp_config WHERE access_token NOT LIKE 'v1:%'`
    )

    if (!pendientes.length) {
      console.log('No había filas pendientes de cifrar.')
      return
    }

    for (const fila of pendientes) {
      await client.query(
        'UPDATE tenant_whatsapp_config SET access_token = $1 WHERE id = $2',
        [cifrar(fila.access_token), fila.id]
      )
    }

    console.log(`${pendientes.length} fila(s) cifradas.`)
  } catch (err) {
    console.error('Error:', err.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()
