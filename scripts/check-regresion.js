#!/usr/bin/env node
// Regresión básica contra producción — correr antes de cada push
// Uso: npm run regresion

const BASE    = 'https://master-baker-production-32b2.up.railway.app'
const TENANT  = '00000000-0000-0000-0000-000000000001'
const FRONTEND = 'https://www.masterbaker.store'

const EMAIL    = 'admin@marquez.com'
const PASSWORD = 'Marquez1988!'

let passed = 0
let failed = 0

function ok(label)   { console.log(`  ✅ ${label}`); passed++ }
function fail(label) { console.error(`  ❌ ${label}`); failed++ }

async function get(path, token) {
  const headers = { 'x-tenant-id': TENANT }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const r = await fetch(`${BASE}${path}`, { headers })
  return r
}

// ── 1. Login ─────────────────────────────────────────────────────────────────
async function checkLogin() {
  console.log('\n📋 Auth')
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (r.status !== 200) { fail(`POST /api/auth/login → ${r.status}`); return null }
  const { token } = await r.json()
  if (!token) { fail('Login OK pero sin token en respuesta'); return null }
  ok('POST /api/auth/login → 200 con token')
  return token
}

// ── 2. Endpoints API ─────────────────────────────────────────────────────────
async function checkEndpoints(token) {
  console.log('\n📋 Endpoints API')
  const endpoints = [
    '/api/catalogo',
    '/api/lotes',
    '/api/sucursales',
    '/api/inventario-terminado',
  ]
  for (const ep of endpoints) {
    const r = await get(ep, token)
    if (r.status === 200) ok(`GET ${ep} → 200`)
    else fail(`GET ${ep} → ${r.status}`)
  }
}

// ── 3. Protección de rol ─────────────────────────────────────────────────────
async function checkRoleProtection() {
  console.log('\n📋 Protección de rol')
  const r = await fetch(`${BASE}/api/inventario-terminado/00000000-0000-0000-0000-000000000000`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT },
    body: JSON.stringify({ stock_minimo: 1 }),
  })
  if (r.status === 401) ok('PATCH /api/inventario-terminado/:id sin token → 401')
  else fail(`PATCH sin token debería ser 401, recibió ${r.status}`)
}

// ── 4. Frontend sidebar ───────────────────────────────────────────────────────
async function checkFrontend() {
  console.log('\n📋 Frontend')
  const r = await fetch(FRONTEND)
  if (r.status !== 200) { fail(`GET ${FRONTEND} → ${r.status}`); return }
  ok(`GET ${FRONTEND} → 200`)

  // El bundle JS contiene las rutas del sidebar
  const html  = await r.text()
  const match = html.match(/src="([^"]*index[^"]*\.js)"/)
  if (!match) { fail('No se encontró bundle JS en el HTML'); return }

  const bundleUrl = `${FRONTEND}${match[1]}`
  const bundle    = await fetch(bundleUrl).then(r => r.text())

  const links = [
    '/dashboard', '/catalogo', '/recetas', '/caja',
    '/stock', '/ventas', '/inventario', '/compras', '/usuarios',
  ]

  for (const path of links) {
    const slug = path.slice(1)
    // Busca la ruta como string o como fragmento de texto (minificación varía)
    if (bundle.includes(`"${path}"`) || bundle.includes(`/${slug}`)) ok(`Sidebar incluye ${slug}`)
    else fail(`Sidebar NO incluye ${slug} (${path})`)
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Regresión Marquéz —', new Date().toLocaleString('es-NI'))
  try {
    const token = await checkLogin()
    await checkEndpoints(token)
    await checkRoleProtection()
    await checkFrontend()
  } catch (e) {
    console.error('\n💥 Error inesperado:', e.message)
    failed++
  }

  console.log(`\n${'─'.repeat(40)}`)
  console.log(`  Passed: ${passed}  Failed: ${failed}`)
  if (failed > 0) {
    console.error(`\n🚨 ${failed} check(s) fallaron — revisa antes de hacer push\n`)
    process.exit(1)
  } else {
    console.log(`\n✅ Todo OK — listo para push\n`)
  }
}

main()
