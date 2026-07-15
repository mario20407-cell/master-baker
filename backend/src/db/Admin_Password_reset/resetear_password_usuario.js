// backend/src/db/resetear_password_usuario.js
// Resetea la contraseña de un usuario existente (no crea ni desactiva
// cuentas). Pensado para uso manual mientras no exista un flujo de
// autoservicio de "olvidé mi contraseña".
//
// Requiere DATABASE_URL en backend/.env apuntando al entorno correcto —
// es responsabilidad de quien lo corre confirmar que apunta al entorno
// deseado antes de ejecutar. Nunca imprime la connection string ni la
// contraseña en texto plano.
//
// Uso: node backend/src/db/resetear_password_usuario.js <email>

import 'dotenv/config'
import pg from 'pg'
import bcrypt from 'bcrypt'
import readline from 'readline'

const { Client } = pg
const SALT_ROUNDS = 12 // mismo valor usado en backend/src/routes/auth.js

const ENTER = 13
const CTRL_C = 3
const BACKSPACE = 127
const BACKSPACE_WIN = 8

function ask(pregunta) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(pregunta, (respuesta) => {
      rl.close()
      resolve(respuesta.trim())
    })
  })
}

// Prompt con eco desactivado, mismo patrón que crear_admin_manual.js —
// lee bytes crudos de stdin en modo raw y solo dibuja asteriscos.
function pedirPasswordOculta(mensaje) {
  return new Promise((resolve) => {
    let password = ''
    process.stdout.write(mensaje)

    const onData = (buffer) => {
      for (const byte of buffer) {
        if (byte === ENTER) {
          process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdin.removeListener('data', onData)
          process.stdout.write('\n')
          resolve(password)
          return
        }
        if (byte === CTRL_C) {
          process.stdout.write('\n')
          process.exit(1)
        }
        if (byte === BACKSPACE || byte === BACKSPACE_WIN) {
          if (password.length > 0) {
            password = password.slice(0, -1)
            process.stdout.write('\b \b')
          }
          continue
        }
        password += String.fromCharCode(byte)
        process.stdout.write('*')
      }
    }

    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Uso: node backend/src/db/resetear_password_usuario.js <email>')
    process.exit(1)
  }

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
    const emailNormalizado = email.toLowerCase().trim()

    const antes = await client.query(
      `SELECT id, email, rol, tenant_id, activo FROM usuarios WHERE email = $1`,
      [emailNormalizado]
    )

    if (antes.rowCount === 0) {
      console.log(`No existe ningún usuario con email ${emailNormalizado} en esta base de datos.`)
      return
    }

    console.log('\nUsuario encontrado:')
    console.table(antes.rows)

    if (antes.rows[0].activo === false) {
      const continuarInactivo = await ask(
        '\nEsta cuenta está DESACTIVADA (activo = false). ¿Igual querés resetear la contraseña? Escribí "SI" para continuar: '
      )
      if (continuarInactivo !== 'SI') {
        console.log('Cancelado. No se hizo ningún cambio.')
        return
      }
    }

    const password = await pedirPasswordOculta('\nContraseña nueva (no se muestra en pantalla): ')
    const passwordConfirmar = await pedirPasswordOculta('Confirmá la contraseña nueva: ')

    if (password !== passwordConfirmar) {
      console.error('Las contraseñas no coinciden. Abortado.')
      process.exitCode = 1
      return
    }
    if (password.length < 8) {
      console.error('La contraseña debe tener al menos 8 caracteres. Abortado.')
      process.exitCode = 1
      return
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS)

    await client.query('BEGIN')
    const resultado = await client.query(
      `UPDATE usuarios SET password_hash = $1 WHERE email = $2 RETURNING id, email`,
      [hash, emailNormalizado]
    )
    await client.query('COMMIT')

    console.log('\nContraseña actualizada:')
    console.table(resultado.rows)

    const despues = await client.query(
      `SELECT id, email, rol, tenant_id, activo FROM usuarios WHERE email = $1`,
      [emailNormalizado]
    )
    console.log('\nVerificación final:')
    console.table(despues.rows)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Error:', err.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()
