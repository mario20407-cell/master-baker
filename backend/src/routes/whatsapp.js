import { Router } from 'express'
import OpenAI from 'openai'
import crypto from 'crypto'
import { verificarYRegistrarUso } from '../middleware/planMiddleware.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { query } from '../db/client.js'

export const publicRouter = Router()
export const privateRouter = Router()

// ── Configuración ─────────────────────────────────────────────────────────────
const WA_TOKEN    = process.env.WHATSAPP_TOKEN
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_ID
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN
const WA_API      = `https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`

const MAX_HISTORIAL = 10 // mensajes recientes que se pasan como contexto a la IA

// ── Catálogo completo Marquéz ─────────────────────────────────────────────────
const CATALOGO = `
🥐 *MENÚ MARQUÉZ PANADERÍA & REPOSTERÍA*

🧆 *SALADOS*
- Pico de queso - C$20
- Maleta de carne - C$35
- Maleta de pollo - C$30
- Empanada de queso - C$20
- Churro de queso - C$20
- Pan pizza - C$40
- Choripán - C$30

🍩 *PAN DULCE*
- Prisionero - C$25
- Quesadilla - C$30
- Trenza frita - C$20
- Repollito - C$20
- Repodona - C$35
- Berlinesa - C$35
- Rol de canela - C$35
- Chemi - C$25

🍩 *DONAS*
- Dona azucarada - C$20
- Dona de chocolate - C$35
- Dona glaseada - C$35

🥐 *HOJALDRE*
- Pañuelo de piña - C$30
- Pañuelo dulce de leche - C$35
- Bolovan - C$50
- Croissant - C$50
- Flor de hojaldre - C$40
- Mil hojas - C$120
- Palmeritas - C$60

🍰 *TORTAS*
- Torta de naranja - C$35
- Torta de vainilla - C$30
- Torta de chocolate - C$40

🎂 *RINES*
- Rin de vainilla - C$150
- Rin de naranja - C$160
- Rin de chocolate - C$190

🍮 *POSTRES*
- Volteado de piña 2oz - C$75
- Volteado de piña 4oz - C$170
- Volteado de piña ½lb - C$320

🍰 *CHEESECAKES*
- Maracuyá (porción) - C$120 | (libra) - C$1,250
- Fresa (porción) - C$140 | (libra) - C$1,300
- Oreo (porción) - C$120 | (libra) - C$1,250

🧁 *CUPCAKES*
- Vainilla - C$25
- Chocolate - C$30

🍪 *GALLETAS*
- Avena - C$20
- Mantequilla - C$20
- Margarita - C$20
- Coco - C$35
- Chocochips - C$40
`

// ── Herramienta que la IA puede llamar para registrar un pedido confirmado ────
const HERRAMIENTAS = [{
  type: 'function',
  function: {
    name: 'registrar_pedido',
    description: 'Registra un pedido YA CONFIRMADO por el cliente (productos, cantidades y precios claros). Úsala también para pedidos agendados para más adelante.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Productos del pedido',
          items: {
            type: 'object',
            properties: {
              producto: { type: 'string' },
              cantidad: { type: 'integer' },
              precio_unitario: { type: 'number' },
            },
            required: ['producto', 'cantidad', 'precio_unitario'],
          },
        },
        total: { type: 'number', description: 'Total del pedido en córdobas' },
        direccion: { type: 'string', description: 'Dirección de entrega, si el cliente la dio' },
        tipo_entrega: { type: 'string', enum: ['inmediato', 'agendado'] },
        fecha_programada: {
          type: 'string',
          description: 'Solo si tipo_entrega es "agendado". Fecha y hora en formato ISO 8601 con offset -06:00, ej: 2026-07-18T15:00:00-06:00',
        },
      },
      required: ['items', 'total', 'tipo_entrega'],
    },
  },
}]

// ── CRM: clientes, historial y pedidos persistentes en la base de datos ───────
// Reemplaza el Map en RAM que se usaba antes (se borraba en cada redeploy).

async function obtenerOCrearCliente(tenantId, telefono) {
  const { rows } = await query(
    `INSERT INTO clientes_whatsapp (tenant_id, telefono, ultima_interaccion)
     VALUES ($1, $2, NOW())
     ON CONFLICT (tenant_id, telefono)
     DO UPDATE SET ultima_interaccion = NOW()
     RETURNING *`,
    [tenantId, telefono]
  )
  return rows[0]
}

async function guardarMensaje(tenantId, clienteId, rol, contenido) {
  if (!contenido) return
  await query(
    `INSERT INTO mensajes_whatsapp (tenant_id, cliente_id, rol, contenido) VALUES ($1, $2, $3, $4)`,
    [tenantId, clienteId, rol, contenido]
  )
}

async function obtenerHistorial(clienteId, limite = MAX_HISTORIAL) {
  const { rows } = await query(
    `SELECT rol, contenido FROM mensajes_whatsapp
     WHERE cliente_id = $1
     ORDER BY creado_en DESC
     LIMIT $2`,
    [clienteId, limite]
  )
  return rows.reverse().map(r => ({ role: r.rol, content: r.contenido }))
}

// Productos que más pidió este cliente históricamente — base de la sugerencia.
async function obtenerProductosFavoritos(clienteId, limite = 3) {
  const { rows } = await query(
    `SELECT item->>'producto' AS producto, COUNT(*) AS veces
     FROM pedidos_whatsapp, jsonb_array_elements(items) AS item
     WHERE cliente_id = $1 AND estado != 'cancelado'
     GROUP BY producto
     ORDER BY veces DESC
     LIMIT $2`,
    [clienteId, limite]
  )
  return rows.map(r => r.producto).filter(Boolean)
}

async function guardarPedido(tenantId, clienteId, datos) {
  const items = Array.isArray(datos.items) ? datos.items : []
  const tipoEntrega = datos.tipo_entrega === 'agendado' ? 'agendado' : 'inmediato'
  const { rows } = await query(
    `INSERT INTO pedidos_whatsapp (tenant_id, cliente_id, items, total, direccion, tipo_entrega, fecha_programada)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      tenantId,
      clienteId,
      JSON.stringify(items),
      datos.total ?? null,
      datos.direccion ?? null,
      tipoEntrega,
      tipoEntrega === 'agendado' ? (datos.fecha_programada ?? null) : null,
    ]
  )
  return rows[0]
}

// ── Prompt del sistema, con contexto real del cliente (fecha, favoritos) ──────
function construirSystemPrompt({ nombreCliente, favoritos }) {
  const ahoraNicaragua = new Date().toLocaleString('es-NI', {
    timeZone: 'America/Managua',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  let contextoCliente = ''
  if (nombreCliente) contextoCliente += `El cliente se llama ${nombreCliente}. `
  if (favoritos?.length) {
    contextoCliente += `Historial: suele pedir ${favoritos.join(', ')}. Si viene al caso podés recordárselo o sugerírselo, sin insistir.`
  }

  return `Eres el asistente virtual de Marquéz Panadería & Repostería en Nicaragua.
Eres amable, eficiente y orientado a ventas. Respondes SIEMPRE en español.
Usas emojis con moderación para hacer la conversación más amena.
Moneda: Córdobas nicaragüenses (C$).

FECHA Y HORA ACTUAL: ${ahoraNicaragua} (Nicaragua, UTC-6). Usala como referencia para calcular fechas cuando el cliente pida agendar algo ("mañana", "el sábado", etc.).
${contextoCliente ? `\nDATOS DE ESTE CLIENTE:\n${contextoCliente}\n` : ''}
CATÁLOGO COMPLETO:
${CATALOGO}

REGLAS:
1. Nunca inventes precios — solo usa los del catálogo.
2. Cuando el cliente quiera pedir, confirma: producto, cantidad y nombre.
3. Para pedidos de delivery pregunta la dirección.
4. Si preguntan por algo que no está en el menú, di amablemente que no está disponible.
5. Respuestas cortas y directas — máximo 3-4 líneas por respuesta.
6. Si el cliente saluda, saluda de vuelta y ofrece el menú.
7. Cuando el cliente CONFIRME un pedido completo (productos, cantidades claras), llamá a la función registrar_pedido con tipo_entrega "inmediato". No la llames si el pedido todavía no está confirmado.
8. Si el cliente quiere agendar el pedido para otro día u hora ("para mañana", "el sábado a las 3pm"), calculá la fecha exacta a partir de la fecha actual de arriba y llamá a registrar_pedido con tipo_entrega "agendado" y fecha_programada en ISO 8601 con offset -06:00. Si no dio la hora, preguntala antes de registrar.
9. Al confirmar un pedido, da el total y avisá que le avisarás por este mismo WhatsApp en cuanto esté listo.

COMANDOS ESPECIALES que debes detectar:
- Si el cliente escribe "menu", "menú" o "ver productos" → muestra el catálogo completo
- Si escribe "hola", "buenas", "buenos días/tardes/noches" → saluda y pregunta cómo puedes ayudar
- Si escribe "horario" → responde: "Estamos abiertos de lunes a sábado de 6am a 7pm 🕕"
- Si escribe "ubicacion" o "dirección" → responde que te ubiques por WhatsApp para coordinar`
}

// ── Función: enviar mensaje a WhatsApp ────────────────────────────────────────
async function enviarMensaje(telefono, texto) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    console.warn('[WhatsApp] Token o Phone ID no configurados')
    return
  }

  const res = await fetch(WA_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: telefono,
      type: 'text',
      text: { body: texto },
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    console.error('[WhatsApp] Error al enviar:', data)
    throw new Error(data.error?.message || 'Error al enviar mensaje')
  }
  return data
}

// ── Función: procesar con GPT-4 mini (con memoria y CRM persistentes) ────────
async function procesarConIA(tenantId, telefono, mensajeUsuario) {
  const cliente = await obtenerOCrearCliente(tenantId, telefono)
  await guardarMensaje(tenantId, cliente.id, 'user', mensajeUsuario)

  if (!process.env.OPENAI_API_KEY) {
    const respuesta = respuestaFallback(mensajeUsuario)
    await guardarMensaje(tenantId, cliente.id, 'assistant', respuesta)
    return respuesta
  }

  const [historial, favoritos] = await Promise.all([
    obtenerHistorial(cliente.id),
    obtenerProductosFavoritos(cliente.id),
  ])

  const systemPrompt = construirSystemPrompt({ nombreCliente: cliente.nombre, favoritos })
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: systemPrompt }, ...historial],
    tools: HERRAMIENTAS,
    tool_choice: 'auto',
    max_tokens: 300,
    temperature: 0.7,
  })

  const mensaje = res.choices[0].message

  // Si la IA decidió registrar un pedido, lo guardamos en el CRM y le
  // pedimos que redacte la confirmación final para el cliente.
  if (mensaje.tool_calls?.length) {
    const llamada = mensaje.tool_calls[0]
    let datos = {}
    try { datos = JSON.parse(llamada.function.arguments) } catch { datos = {} }

    const pedido = await guardarPedido(tenantId, cliente.id, datos)

    const seguimiento = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...historial,
        mensaje,
        {
          role: 'tool',
          tool_call_id: llamada.id,
          content: JSON.stringify({ ok: true, pedido_id: pedido.id }),
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    })

    const respuestaFinal = seguimiento.choices[0].message.content
      || 'Perfecto, tu pedido quedó registrado 🎉 Te aviso por acá en cuanto esté listo.'
    await guardarMensaje(tenantId, cliente.id, 'assistant', respuestaFinal)
    return respuestaFinal
  }

  const respuesta = mensaje.content || respuestaFallback(mensajeUsuario)
  await guardarMensaje(tenantId, cliente.id, 'assistant', respuesta)
  return respuesta
}

// ── Fallback sin IA (respuestas básicas) ──────────────────────────────────────
function respuestaFallback(mensaje) {
  const msg = mensaje.toLowerCase()
  if (msg.includes('menu') || msg.includes('menú') || msg.includes('productos')) {
    return CATALOGO + '\n\n¿Qué te gustaría pedir? 😊'
  }
  if (msg.includes('hola') || msg.includes('buenas') || msg.includes('buenos')) {
    return '¡Hola! 👋 Bienvenido a *Marquéz Panadería & Repostería*. ¿En qué te puedo ayudar? Escribe *menú* para ver nuestros productos.'
  }
  if (msg.includes('horario')) {
    return '🕕 Estamos abiertos de *lunes a sábado* de 6am a 7pm. ¡Te esperamos!'
  }
  if (msg.includes('precio') || msg.includes('cuanto') || msg.includes('cuánto')) {
    return 'Escribe *menú* para ver todos nuestros productos con precios 😊'
  }
  return '¡Hola! Soy el asistente de *Marquéz Panadería*. Escribe *menú* para ver nuestros productos o dime en qué te puedo ayudar 🥐'
}

// ── Webhook: verificación Meta ────────────────────────────────────────────────
publicRouter.get('/webhook', (req, res) => {
  if (!VERIFY_TOKEN) {
    console.error('[WhatsApp] WHATSAPP_VERIFY_TOKEN no configurado en las variables de entorno')
    return res.status(500).json({ error: 'Error de configuración del servidor' })
  }

  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WhatsApp] Webhook verificado ✅')
    res.status(200).send(challenge)
  } else {
    console.error('[WhatsApp] Token de verificación incorrecto')
    res.status(403).json({ error: 'Token inválido' })
  }
})

// ── Webhook: recibir mensajes ─────────────────────────────────────────────────
publicRouter.post('/webhook', async (req, res) => {
  // Validar firma x-hub-signature-256 de Meta
  const signatureHeader = req.headers['x-hub-signature-256']
  const appSecret = process.env.META_APP_SECRET

  if (appSecret) {
    if (!signatureHeader) {
      console.error('[WhatsApp Webhook] Firma x-hub-signature-256 ausente')
      return res.status(401).send('Firma ausente')
    }
    const signature = signatureHeader.split('=')[1]
    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(req.rawBody || '')
      .digest('hex')

    if (signature !== expectedSignature) {
      console.error('[WhatsApp Webhook] Firma x-hub-signature-256 inválida')
      return res.status(401).send('Firma inválida')
    }
  } else {
    console.warn('[WhatsApp Webhook] META_APP_SECRET no configurado. Omitiendo validación de firma.')
  }

  // Responder 200 inmediatamente para que Meta no reintente
  res.status(200).send('OK')

  try {
    const body = req.body
    if (body.object !== 'whatsapp_business_account') return

    // PENDIENTE: req.tenantId aquí siempre resuelve al default (Marquéz),
    // porque Meta no manda header x-tenant-id ni subdominio — este webhook
    // no distingue todavía entre números de WhatsApp de distintos tenants.
    // Ver nota en tenantMiddleware.js. Hoy no es un problema porque solo
    // existe un tenant real operando.
    const chequeoPlan = await verificarYRegistrarUso(req.tenantId, 'whatsapp_bot')
    if (!chequeoPlan.permitido) {
      console.warn(`[WhatsApp] Tenant ${req.tenantId} sin acceso al bot según su plan — mensajes ignorados`)
      return
    }

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value
        if (!value?.messages?.length) continue

        for (const message of value.messages) {
          // Solo procesar mensajes de texto
          if (message.type !== 'text') continue

          const telefono = message.from
          const texto    = message.text.body.trim()

          console.log(`[WhatsApp] Mensaje de ${telefono}: "${texto}"`)

          // Procesar con IA (guarda memoria y detecta pedidos en el CRM)
          const respuesta = await procesarConIA(req.tenantId, telefono, texto)

          // Enviar respuesta
          await enviarMensaje(telefono, respuesta)
          console.log(`[WhatsApp] Respuesta enviada a ${telefono}`)
        }
      }
    }
  } catch (e) {
    console.error('[WhatsApp] Error procesando webhook:', e.message)
  }
})

// ── Endpoint: enviar mensaje manual desde el dashboard ───────────────────────
privateRouter.post('/enviar', requireAuth, async (req, res, next) => {
  const { telefono, mensaje } = req.body
  if (!telefono || !mensaje) {
    return res.status(400).json({ error: 'telefono y mensaje son requeridos' })
  }
  try {
    const data = await enviarMensaje(telefono, mensaje)
    res.json({ ok: true, data })
  } catch (e) { next(e) }
})

// ── Endpoint: marcar un pedido como "listo" y avisarle al cliente ────────────
privateRouter.put('/pedidos/:id/listo', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, c.telefono, c.nombre
       FROM pedidos_whatsapp p
       JOIN clientes_whatsapp c ON c.id = p.cliente_id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [req.params.id, req.tenantId]
    )
    const pedido = rows[0]
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' })

    await query(
      `UPDATE pedidos_whatsapp SET estado = 'listo', notificado_listo = true WHERE id = $1`,
      [pedido.id]
    )

    const nombre = pedido.nombre ? pedido.nombre.split(' ')[0] : ''
    const saludo = nombre ? `¡Hola ${nombre}!` : '¡Hola!'
    const mensajeAviso = `${saludo} 🎉 Tu pedido en Marquéz Panadería ya está listo. ¡Te esperamos!`

    let avisado = true
    try {
      await enviarMensaje(pedido.telefono, mensajeAviso)
    } catch (e) {
      avisado = false
      console.error('[WhatsApp] No se pudo notificar al cliente:', e.message)
    }

    res.json({ ok: true, avisado })
  } catch (e) { next(e) }
})

// ── Endpoint: cambiar el estado de un pedido (confirmado, en_preparacion, etc.) ─
privateRouter.put('/pedidos/:id/estado', requireAuth, async (req, res, next) => {
  const ESTADOS_VALIDOS = ['pendiente', 'confirmado', 'en_preparacion', 'listo', 'entregado', 'cancelado']
  const { estado } = req.body || {}
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' })
  }
  try {
    const { rows } = await query(
      `UPDATE pedidos_whatsapp SET estado = $1 WHERE id = $2 AND tenant_id = $3 RETURNING id`,
      [estado, req.params.id, req.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// ── Endpoint: listar pedidos (para el panel — pendientes y agendados primero) ─
privateRouter.get('/pedidos', requireAuth, async (req, res, next) => {
  try {
    const { estado, tipo_entrega } = req.query
    const condiciones = ['p.tenant_id = $1']
    const params = [req.tenantId]

    if (estado) {
      params.push(estado)
      condiciones.push(`p.estado = $${params.length}`)
    }
    if (tipo_entrega) {
      params.push(tipo_entrega)
      condiciones.push(`p.tipo_entrega = $${params.length}`)
    }

    const { rows } = await query(
      `SELECT p.*, c.telefono, c.nombre
       FROM pedidos_whatsapp p
       JOIN clientes_whatsapp c ON c.id = p.cliente_id
       WHERE ${condiciones.join(' AND ')}
       ORDER BY COALESCE(p.fecha_programada, p.creado_en) ASC`,
      params
    )
    res.json({ pedidos: rows })
  } catch (e) { next(e) }
})

// ── Endpoint: listar clientes del bot con su historial de consumo (CRM) ───────
privateRouter.get('/clientes', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.*,
              COUNT(p.id) FILTER (WHERE p.estado != 'cancelado') AS total_pedidos,
              COALESCE(SUM(p.total) FILTER (WHERE p.estado != 'cancelado'), 0) AS total_gastado
       FROM clientes_whatsapp c
       LEFT JOIN pedidos_whatsapp p ON p.cliente_id = c.id
       WHERE c.tenant_id = $1
       GROUP BY c.id
       ORDER BY c.ultima_interaccion DESC`,
      [req.tenantId]
    )
    res.json({ clientes: rows })
  } catch (e) { next(e) }
})

// ── Endpoint: ver historial de conversación de un cliente ────────────────────
privateRouter.get('/clientes/:telefono/mensajes', requireAuth, async (req, res, next) => {
  try {
    const { rows: clienteRows } = await query(
      `SELECT id FROM clientes_whatsapp WHERE tenant_id = $1 AND telefono = $2`,
      [req.tenantId, req.params.telefono]
    )
    if (!clienteRows[0]) return res.json({ telefono: req.params.telefono, mensajes: [] })

    const { rows } = await query(
      `SELECT rol, contenido, creado_en FROM mensajes_whatsapp
       WHERE cliente_id = $1 ORDER BY creado_en ASC`,
      [clienteRows[0].id]
    )
    res.json({ telefono: req.params.telefono, mensajes: rows })
  } catch (e) { next(e) }
})

// ── Endpoint: status del bot ──────────────────────────────────────────────────
privateRouter.get('/status', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS clientes FROM clientes_whatsapp WHERE tenant_id = $1`,
      [req.tenantId]
    )
    res.json({
      activo:           !!WA_TOKEN && !!WA_PHONE_ID,
      phone_id:         WA_PHONE_ID || 'No configurado',
      ia_activa:        !!process.env.OPENAI_API_KEY,
      modelo:           'gpt-4o-mini',
      clientes:         rows[0]?.clientes || 0,
    })
  } catch (e) { next(e) }
})

const mainRouter = Router()
mainRouter.use(publicRouter)
mainRouter.use(privateRouter)
export default mainRouter
