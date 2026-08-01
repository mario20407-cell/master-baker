#!/usr/bin/env node
// Guard barato contra el "olvido de tenant_id" — no reemplaza RLS real
// (ver decisiones/2026-07-29-rls-real-diferido.md), pero ataca
// directamente la parte más barata del riesgo: que una query nueva toque
// una tabla de negocio sin filtrar por tenant_id, y nadie lo note en la
// revisión.
//
// Es un heurístico, no un parser SQL real: busca llamadas a query(...) /
// client.query(...) en las rutas del backend, y si el texto de la
// consulta toca una tabla que vive por-tenant, exige que "tenant_id"
// aparezca en algún lado de esa misma llamada. Puede tener falsos
// positivos en queries genuinamente cross-tenant (admin, webhooks antes
// de resolver el tenant) — para esos casos, usar el comentario
// `// tenant-guard: ignorar — <razón>` en la línea anterior a la query.
//
// Uso: node scripts/guard-tenant-id.mjs
// Sale con código 1 si encuentra algo, 0 si todo está limpio.

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
// Antes solo escaneaba src/routes — dejaba afuera src/services y
// src/middleware, donde también hay queries a tablas por-tenant (ver
// auditoría QA 2026-07-31, hallazgo ALTO #3: planMiddleware.js corría sin
// que este guard lo viera nunca). Rutas siguen primero en la lista porque
// es donde vive la inmensa mayoría de las queries.
const DIRS_ESCANEADOS = [
  join(__dirname, '..', 'src', 'routes'),
  join(__dirname, '..', 'src', 'services'),
  join(__dirname, '..', 'src', 'middleware'),
]

// Tablas de negocio que llevan tenant_id en schema.sql. tenants/planes son
// las únicas tablas de negocio sin tenant_id (son las que LO DEFINEN), y
// se excluyen a propósito.
const TABLAS_POR_TENANT = [
  'usuarios', 'pagos_variables', 'sucursales', 'productos', 'recetas',
  'ingredientes', 'costeos', 'inventario', 'inventario_terminado',
  'facturas', 'factura_items', 'config_fiscal', 'configuracion_costeo',
  'ventas', 'venta_items', 'ordenes_produccion', 'lotes',
  'lote_distribuciones', 'caja_produccion', 'sugerencias_produccion',
  'auditoria_precios', 'bitacora_actividades', 'ai_usage_log',
  'actividad_heartbeats', 'uso_ia_mensual', 'clientes_whatsapp',
  'mensajes_whatsapp', 'pedidos_whatsapp', 'tenant_whatsapp_config',
  'planillas', 'planilla_detalle',
]

// Archivos completos excluidos: por diseño, hablan con la base sin
// contexto de un tenant específico (protegidos por su propio mecanismo,
// no por requireAuth+tenantId). Ver decisiones/2026-07-29-rls-real-diferido.md.
const ARCHIVOS_EXCLUIDOS = new Set([
  'admin.js', // protegido por x-admin-token, cross-tenant por diseño
])

function listarArchivosJs(dir) {
  const resultado = []
  let entradas
  try {
    entradas = readdirSync(dir)
  } catch {
    return resultado // directorio no existe (ej. src/middleware en otro proyecto) — no es error
  }
  for (const entrada of entradas) {
    if (entrada === '__tests__') continue
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) {
      resultado.push(...listarArchivosJs(ruta))
    } else if (entrada.endsWith('.js')) {
      resultado.push(ruta)
    }
  }
  return resultado
}

function tocaTablaPorTenant(sql) {
  const sqlLower = sql.toLowerCase()
  return TABLAS_POR_TENANT.find(tabla => {
    const patron = new RegExp(`\\b(from|into|update|join)\\s+${tabla}\\b`, 'i')
    return patron.test(sqlLower)
  })
}

// Patrón muy común en este código: construir el WHERE en una variable
// aparte (params.length dinámico según filtros opcionales) e interpolarla
// en el template de la query — ej. `let where = 'WHERE tenant_id = $1'`
// seguido de `` `SELECT * FROM x ${where}` ``. El regex de arriba no ve
// tenant_id porque no está en el mismo template literal. Esta función
// busca, para cada variable interpolada con ${nombre}, su asignación
// inicial (let/const nombre = '...') y cualquier nombre += '...' antes de
// la llamada a query(), y concatena todo ese texto para el chequeo.
function resolverInterpolaciones(sqlTexto, contenido, offsetLlamada) {
  // Cubre tanto ${nombre} como ${nombre.join(...)} / ${nombre.algo} —
  // solo nos interesa el identificador inicial en cualquiera de los casos.
  const nombresInterpolados = [...sqlTexto.matchAll(/\$\{\s*(\w+)/g)].map(m => m[1])
  if (nombresInterpolados.length === 0) return sqlTexto

  const contextoPrevio = contenido.slice(Math.max(0, offsetLlamada - 2000), offsetLlamada)
  let extra = ''
  for (const nombre of nombresInterpolados) {
    // Variantes cubiertas: let/const x = '...'; x += '...'; const x = [...]
    // (array de condiciones, patrón muy usado acá); x.push('...').
    const asignacion = new RegExp(`(?:let|const|var)\\s+${nombre}\\s*=\\s*(['"\`])([\\s\\S]*?)\\1`, 'g')
    const incrementos = new RegExp(`\\b${nombre}\\s*\\+=\\s*(['"\`])([\\s\\S]*?)\\1`, 'g')
    const arrayInicial = new RegExp(`(?:let|const|var)\\s+${nombre}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'g')
    const pushes = new RegExp(`\\b${nombre}\\.push\\(([\\s\\S]*?)\\)`, 'g')
    for (const m of contextoPrevio.matchAll(asignacion)) extra += ' ' + m[2]
    for (const m of contextoPrevio.matchAll(incrementos)) extra += ' ' + m[2]
    for (const m of contextoPrevio.matchAll(arrayInicial)) extra += ' ' + m[1]
    for (const m of contextoPrevio.matchAll(pushes)) extra += ' ' + m[1]
  }
  return sqlTexto + ' ' + extra
}

function extraerLlamadasQuery(contenido) {
  // Busca "query(" o "client.query(" o ".query(" seguido de un template
  // literal o string — best effort, no un parser real de JS.
  const llamadas = []
  const patron = /(?:^|[^.\w])(?:query|client\.query)\s*\(\s*(`[\s\S]*?`|'[^']*'|"[^"]*")/g
  let match
  while ((match = patron.exec(contenido)) !== null) {
    const sqlTexto = match[1].slice(1, -1) // quita las comillas/backticks
    const sqlResuelto = resolverInterpolaciones(sqlTexto, contenido, match.index)
    const antesDelMatch = contenido.slice(0, match.index)
    const numeroLinea = antesDelMatch.split('\n').length
    llamadas.push({ sql: sqlResuelto, linea: numeroLinea })
  }

  // tenantQuery(tenantId, sql, params) — RLS real (ver db/client.js). El SQL
  // es el SEGUNDO argumento, no el primero. El primer argumento ya obliga a
  // pasar un tenantId explícito (fail-closed en tiempo de ejecución si falta),
  // así que esto es un refuerzo de estilo/legibilidad, no la defensa principal.
  const patronTenantQuery = /(?:^|[^.\w])tenantQuery\s*\(\s*[^,]+,\s*(`[\s\S]*?`|'[^']*'|"[^"]*")/g
  while ((match = patronTenantQuery.exec(contenido)) !== null) {
    const sqlTexto = match[1].slice(1, -1)
    const sqlResuelto = resolverInterpolaciones(sqlTexto, contenido, match.index)
    const antesDelMatch = contenido.slice(0, match.index)
    const numeroLinea = antesDelMatch.split('\n').length
    llamadas.push({ sql: sqlResuelto, linea: numeroLinea })
  }

  return llamadas
}

function lineaTieneIgnorar(lineas, numeroLinea) {
  // El comentario puede ser de varias líneas — se sube por el bloque de
  // comentarios contiguo inmediatamente arriba de la query (no solo la
  // línea justo anterior) hasta encontrar la marca o una línea que ya no
  // sea comentario.
  for (let i = numeroLinea - 2; i >= 0; i--) {
    const linea = (lineas[i] || '').trim()
    if (linea.includes('tenant-guard: ignorar')) return true
    if (!linea.startsWith('//')) break
  }
  return false
}

function main() {
  const archivos = DIRS_ESCANEADOS.flatMap(listarArchivosJs)
  const hallazgos = []

  for (const archivo of archivos) {
    const nombreArchivo = archivo.split(/[/\\]/).pop()
    if (ARCHIVOS_EXCLUIDOS.has(nombreArchivo)) continue

    const contenido = readFileSync(archivo, 'utf-8')
    const lineas = contenido.split('\n')
    const llamadas = extraerLlamadasQuery(contenido)

    for (const { sql, linea } of llamadas) {
      const tabla = tocaTablaPorTenant(sql)
      if (!tabla) continue
      if (sql.toLowerCase().includes('tenant_id')) continue
      if (lineaTieneIgnorar(lineas, linea)) continue

      hallazgos.push({
        archivo: relative(join(__dirname, '..'), archivo),
        linea,
        tabla,
      })
    }
  }

  if (hallazgos.length === 0) {
    console.log('✓ guard-tenant-id: sin hallazgos — todas las queries a tablas por-tenant filtran tenant_id.')
    process.exit(0)
  }

  console.error(`✗ guard-tenant-id: ${hallazgos.length} query(s) tocan una tabla por-tenant sin "tenant_id" visible:\n`)
  for (const h of hallazgos) {
    console.error(`  ${h.archivo}:${h.linea} — toca "${h.tabla}"`)
  }
  console.error(`\nSi alguna de estas es intencional (cross-tenant por diseño), agregá un comentario`)
  console.error(`"// tenant-guard: ignorar — <razón>" en la línea anterior a la query.`)
  process.exit(1)
}

main()
