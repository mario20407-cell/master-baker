import 'dotenv/config'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import readline from 'readline'

const { Pool } = pg
const LLAVE_UNIVERSAL = '1'
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const preguntar = (texto) => new Promise(resolve => rl.question(texto, resolve))

const Q_TENANTS  = 'SELECT id, nombre_negocio, plan FROM tenants WHERE LOWER(nombre_negocio) LIKE LOWER(' + String.fromCharCode(36) + '1) AND activo = true'
const Q_USUARIOS = 'SELECT id, nombre, email, rol, activo FROM usuarios WHERE tenant_id = ' + String.fromCharCode(36) + '1 AND (LOWER(nombre) LIKE LOWER(' + String.fromCharCode(36) + '2) OR LOWER(email) LIKE LOWER(' + String.fromCharCode(36) + '2))'
const Q_UPD_PASS = 'UPDATE usuarios SET password_hash = ' + String.fromCharCode(36) + '1, activo = true WHERE id = ' + String.fromCharCode(36) + '2'
const Q_UPD_PASS_SOLO = 'UPDATE usuarios SET password_hash = ' + String.fromCharCode(36) + '1 WHERE id = ' + String.fromCharCode(36) + '2'
const Q_DESBLOQUEAR  = 'UPDATE usuarios SET activo = true WHERE id = ' + String.fromCharCode(36) + '1'

async function main() {
  console.log('=== Master Baker - Soporte de cuentas ===')
  const llave = await preguntar('Llave universal: ')
  if (llave.trim() !== LLAVE_UNIVERSAL) { console.log('ERROR: Llave incorrecta.'); process.exit(1) }
  console.log('OK: Llave correcta')

  const nombrePanaderia = await preguntar('Nombre de la panaderia: ')
  const { rows: tenants } = await pool.query(Q_TENANTS, ['%' + nombrePanaderia.trim() + '%'])
  if (!tenants.length) { console.log('ERROR: Panaderia no encontrada.'); process.exit(1) }

  let tenant
  if (tenants.length === 1) {
    tenant = tenants[0]
    console.log('Panaderia: ' + tenant.nombre_negocio + ' (plan: ' + tenant.plan + ')')
  } else {
    tenants.forEach((t, i) => console.log((i+1) + '. ' + t.nombre_negocio))
    const idx = await preguntar('Elige numero: ')
    tenant = tenants[parseInt(idx)-1]
    if (!tenant) { console.log('ERROR: Opcion invalida.'); process.exit(1) }
  }

  const nombreUsuario = await preguntar('Nombre o email del usuario: ')
  const { rows: usuarios } = await pool.query(Q_USUARIOS, [tenant.id, '%' + nombreUsuario.trim() + '%'])
  if (!usuarios.length) { console.log('ERROR: Usuario no encontrado.'); process.exit(1) }

  let usuario
  if (usuarios.length === 1) {
    usuario = usuarios[0]
  } else {
    usuarios.forEach((u, i) => console.log((i+1) + '. ' + u.nombre + ' (' + u.email + ') activo: ' + u.activo))
    const idx = await preguntar('Elige numero: ')
    usuario = usuarios[parseInt(idx)-1]
    if (!usuario) { console.log('ERROR: Opcion invalida.'); process.exit(1) }
  }

  console.log('Usuario: ' + usuario.nombre + ' | Estado: ' + (usuario.activo ? 'Activo' : 'BLOQUEADO') + ' | Rol: ' + usuario.rol)
  console.log('1=Resetear+Desbloquear  2=Solo desbloquear  3=Solo resetear')
  const accion = await preguntar('Elige (1/2/3): ')

  if (accion === '1' || accion === '3') {
    const pass1 = await preguntar('Nueva contrasena (min 8 caracteres): ')
    if (pass1.length < 8) { console.log('ERROR: Minimo 8 caracteres.'); process.exit(1) }
    const pass2 = await preguntar('Confirmar contrasena: ')
    if (pass1 !== pass2) { console.log('ERROR: No coinciden.'); process.exit(1) }
    const hash = await bcrypt.hash(pass1, 12)
    if (accion === '1') {
      await pool.query(Q_UPD_PASS, [hash, usuario.id])
      console.log('OK: Contrasena reseteada y cuenta desbloqueada.')
    } else {
      await pool.query(Q_UPD_PASS_SOLO, [hash, usuario.id])
      console.log('OK: Contrasena reseteada.')
    }
  } else if (accion === '2') {
    await pool.query(Q_DESBLOQUEAR, [usuario.id])
    console.log('OK: Cuenta desbloqueada.')
  } else {
    console.log('ERROR: Opcion invalida.'); process.exit(1)
  }

  console.log('Listo. Notifica al usuario sus nuevas credenciales.')
  await pool.end()
  rl.close()
  process.exit(0)
}

main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1) })
