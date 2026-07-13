// backend/src/db/Admin_Password_reset/desactivar_admin_marquez.js
// Desactiva la cuenta admin@marquez.com (no la borra) para cerrar el acceso
// con la credencial hardcodeada que estuvo expuesta en el repo (ver PR #8:
// "security: remove hardcoded admin password reset on backend startup").
//
// Requiere DATABASE_URL en backend/.env apuntando al entorno correcto —
// es responsabilidad de quien lo corre confirmar que apunta a producción
// antes de ejecutar. Nunca imprime la connection string.
//
// Uso: node backend/src/db/Admin_Password_reset/desactivar_admin_marquez.js

import 'dotenv/config'
import pg from 'pg'
import readline from 'readline'

const { Client } = pg

function ask(pregunta) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(pregunta, (respuesta) => {
      rl.close()
      resolve(respuesta.trim())
    })
  })
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL no está configurado en backend/.env')
    process.exit(1)
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  try {
    const antes = await client.query(
      `SELECT id, email, activo, rol, tenant_id, creado_en, ultimo_login
       FROM usuarios WHERE email = $1`,
      ['admin@marquez.com']
    )

    if (antes.rowCount === 0) {
      console.log('No existe ninguna cuenta con email admin@marquez.com en esta base de datos.')
      return
    }

    console.log('\nEstado actual:')
    console.table(antes.rows)

    if (antes.rows[0].activo === false) {
      console.log('La cuenta ya está desactivada. No hace falta hacer nada.')
      return
    }

    const confirmacion = await ask(
      '\n¿Confirmás DESACTIVAR esta cuenta (activo = false)? Escribí "SI" para continuar: '
    )
    if (confirmacion !== 'SI') {
      console.log('Cancelado. No se hizo ningún cambio.')
      return
    }

    await client.query('BEGIN')
    const resultado = await client.query(
      `UPDATE usuarios SET activo = false WHERE email = $1 RETURNING id, email, activo`,
      ['admin@marquez.com']
    )
    await client.query('COMMIT')

    console.log('\nActualizado:')
    console.table(resultado.rows)

    const despues = await client.query(
      `SELECT id, email, activo, rol FROM usuarios WHERE email = $1`,
      ['admin@marquez.com']
    )
    console.log('\nVerificación final:')
    console.table(despues.rows)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Error:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
