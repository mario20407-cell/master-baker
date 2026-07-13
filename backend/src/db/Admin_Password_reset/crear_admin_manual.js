/**
 * crear_admin_manual.js
 *
 * Crea un usuario admin dentro de un tenant ya existente, sin pasar por
 * la API ni por ningún proceso intermedio. Pensado para correrse a mano,
 * una sola vez, directo en la terminal del operador.
 *
 * La contraseña se pide por prompt interactivo con eco desactivado
 * (nunca como argumento de línea de comando, para que no quede en el
 * historial del shell) y no se imprime ni se loguea en ningún momento,
 * ni ella ni el hash resultante.
 *
 * Uso:
 *   TENANT_ID=00000000-0000-0000-0000-000000000001 \
 *   ADMIN_EMAIL=tu@correo.com \
 *   ADMIN_NOMBRE="Tu Nombre" \
 *   node src/db/crear_admin_manual.js
 *
 * Requiere DATABASE_URL configurado en backend/.env (apuntando al
 * entorno correcto — verificalo vos mismo antes de correr esto).
 */

import 'dotenv/config'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const ENTER     = 13
const CTRL_C    = 3
const BACKSPACE = 127
const BACKSPACE_WIN = 8

const TENANT_ID   = process.env.TENANT_ID
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL
const ADMIN_NOMBRE = process.env.ADMIN_NOMBRE

if (!TENANT_ID || !ADMIN_EMAIL || !ADMIN_NOMBRE) {
  console.error('Faltan variables: TENANT_ID, ADMIN_EMAIL y ADMIN_NOMBRE son requeridas.')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL no está configurado en backend/.env')
  process.exit(1)
}

// ── Prompt con eco desactivado: no usa readline.question (que sí hace
// eco), lee bytes crudos de stdin en modo raw y solo dibuja asteriscos. ──
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
  const password = await pedirPasswordOculta('Contraseña para el nuevo admin (no se muestra en pantalla): ')
  const passwordConfirmar = await pedirPasswordOculta('Confirmá la contraseña: ')

  if (password !== passwordConfirmar) {
    console.error('Las contraseñas no coinciden. Abortado.')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres. Abortado.')
    process.exit(1)
  }

  const hash = await bcrypt.hash(password, 12)

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (tenant_id, email, password_hash, nombre, rol, activo)
       VALUES ($1, $2, $3, $4, 'admin', true)
       RETURNING id, email, nombre, rol, creado_en`,
      [TENANT_ID, ADMIN_EMAIL.toLowerCase().trim(), hash, ADMIN_NOMBRE.trim()]
    )
    console.log('Usuario admin creado correctamente:')
    console.log(JSON.stringify(rows[0], null, 2))
  } catch (e) {
    if (e.code === '23505') {
      console.error('Ya existe un usuario con ese email.')
    } else {
      console.error('Error al crear el usuario:', e.message)
    }
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
