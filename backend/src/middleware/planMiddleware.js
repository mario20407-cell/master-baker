/**
 * planMiddleware.js
 *
 * Aplica las reglas del paquete (Básico/Medio/Pro) de cada tenant:
 *   1. Verifica que la función pedida esté habilitada en su plan.
 *   2. Verifica que no haya superado su tope mensual de mensajes de IA.
 *   3. Si pasa ambas, incrementa el contador de consumo del mes.
 *
 * ESTADO ACTUAL (operación manual):
 *   El plan de cada tenant se asigna a mano en la tabla `tenants`
 *   (columna `plan`) vía SQL Editor de Supabase. No hay cobro
 *   automático ni panel de autoservicio todavía — eso se añade
 *   después sin tener que tocar este archivo ni las rutas.
 *
 * DOS FORMAS DE USO:
 *
 *   1. Middleware directo, cuando la ruta siempre representa la
 *      misma función (ej. el webhook de WhatsApp):
 *        import { requierePlan } from '../middleware/planMiddleware.js'
 *        router.post('/webhook', requierePlan('whatsapp_bot'), handler)
 *
 *   2. Llamada manual, cuando la función a verificar se decide
 *      DENTRO de la ruta (ej. /api/ai/chat, que clasifica el tipo
 *      de tarea según el body antes de saber qué función aplica):
 *        import { verificarYRegistrarUso } from '../middleware/planMiddleware.js'
 *        const resultado = await verificarYRegistrarUso(req.tenantId, 'costeo_masivo')
 *        if (!resultado.permitido) return res.status(resultado.status).json(resultado.body)
 *
 * Las columnas de la tabla `planes` que representan funciones son:
 *   whatsapp_bot | asesor_negocio | costeo_masivo | analisis_profundo | leer_documentos
 */
import { query, transaction } from '../db/client.js'

// Cache simple en memoria de la definición de planes — cambia poco,
// no vale la pena consultar la tabla `planes` en cada request.
// Se invalida solo al reiniciar el proceso (igual que tenantCache
// en tenantMiddleware.js).
let planesCache = null
let planesCacheEn = 0
const PLANES_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos

async function obtenerDefinicionPlanes() {
  const ahora = Date.now()
  if (planesCache && (ahora - planesCacheEn) < PLANES_CACHE_TTL_MS) {
    return planesCache
  }
  const { rows } = await query('SELECT * FROM planes')
  planesCache = new Map(rows.map(p => [p.id, p]))
  planesCacheEn = ahora
  return planesCache
}

function anioMesActual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Núcleo de la lógica — independiente de Express.
 * Devuelve { permitido: true } o { permitido: false, status, body }
 * listo para usarse como res.status(status).json(body).
 *
 * FAIL-OPEN: si algo falla por un error interno (ej. base de datos
 * caída), se devuelve permitido=true para no tumbar el sistema por
 * un problema de infraestructura. Se loguea para que quede registro.
 */
export async function verificarYRegistrarUso(tenantId, nombreFuncion) {
  try {
    if (!tenantId) {
      console.error('[planMiddleware] tenantId no resuelto — dejando pasar (fail-open)')
      return { permitido: true }
    }

    const { rows: tenantRows } = await query('SELECT plan FROM tenants WHERE id = $1', [tenantId])
    const tenant = tenantRows[0]
    if (!tenant) {
      console.error(`[planMiddleware] Tenant ${tenantId} no encontrado — dejando pasar (fail-open)`)
      return { permitido: true }
    }

    const planes = await obtenerDefinicionPlanes()
    const definicion = planes.get(tenant.plan)
    if (!definicion) {
      console.error(`[planMiddleware] Plan "${tenant.plan}" no definido en tabla planes — dejando pasar (fail-open)`)
      return { permitido: true }
    }

    if (!definicion[nombreFuncion]) {
      return {
        permitido: false,
        status: 403,
        body: {
          error: `Esta función no está disponible en tu plan actual (${definicion.nombre_visible})`,
          plan_actual: tenant.plan,
          funcion_requerida: nombreFuncion,
        },
      }
    }

    const limite = definicion.limite_mensajes_ia_mes
    const anioMes = anioMesActual()

    if (limite === null) {
      // Plan ilimitado — igual incrementamos el contador para tener
      // el dato histórico de consumo real (útil para fijar precios).
      await query(`
        INSERT INTO uso_ia_mensual (tenant_id, anio_mes, mensajes_usados)
        VALUES ($1, $2, 1)
        ON CONFLICT (tenant_id, anio_mes)
        DO UPDATE SET mensajes_usados = uso_ia_mensual.mensajes_usados + 1, actualizado_en = NOW()
      `, [tenantId, anioMes])
      return { permitido: true }
    }

    // Plan con tope — verificar e incrementar de forma atómica para
    // evitar que dos requests simultáneos pasen el límite a la vez.
    const permitido = await transaction(async (client) => {
      const { rows } = await client.query(
        'SELECT mensajes_usados FROM uso_ia_mensual WHERE tenant_id = $1 AND anio_mes = $2 FOR UPDATE',
        [tenantId, anioMes]
      )
      const usados = rows[0]?.mensajes_usados || 0
      if (usados >= limite) return false

      await client.query(`
        INSERT INTO uso_ia_mensual (tenant_id, anio_mes, mensajes_usados)
        VALUES ($1, $2, 1)
        ON CONFLICT (tenant_id, anio_mes)
        DO UPDATE SET mensajes_usados = uso_ia_mensual.mensajes_usados + 1, actualizado_en = NOW()
      `, [tenantId, anioMes])
      return true
    })

    if (!permitido) {
      return {
        permitido: false,
        status: 429,
        body: {
          error: `Alcanzaste el límite de mensajes de IA de tu plan (${definicion.nombre_visible}: ${limite}/mes)`,
          plan_actual: tenant.plan,
          limite_mensual: limite,
        },
      }
    }

    return { permitido: true }
  } catch (e) {
    console.error('[planMiddleware] Error verificando plan:', e.message)
    console.warn('[planMiddleware] Dejando pasar request sin verificar límites por error interno (fail-open)')
    return { permitido: true }
  }
}

/**
 * Middleware factory para rutas donde la función es fija y conocida
 * de antemano (no depende del body del request).
 */
export function requierePlan(nombreFuncion) {
  return async function planMiddleware(req, res, next) {
    const resultado = await verificarYRegistrarUso(req.tenantId, nombreFuncion)
    if (!resultado.permitido) {
      return res.status(resultado.status).json(resultado.body)
    }
    next()
  }
}