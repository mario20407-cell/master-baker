import { Router } from 'express'
import OpenAI from 'openai'
import { query } from '../db/client.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

// ── Configuración ─────────────────────────────────────────────────────────────
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'marquez_verify_2024'
const getWAPhoneId = () => process.env.WHATSAPP_PHONE_ID
const getWAAPI     = () => `https://graph.facebook.com/v20.0/${getWAPhoneId()}/messages`

// Token leído de DB (cache 5 min para no consultar en cada mensaje)
let _waTokenCache = { value: null, at: 0 }
async function getWAToken(tenantId = '00000000-0000-0000-0000-000000000001') {
  if (Date.now() - _waTokenCache.at < 5 * 60 * 1000) return _waTokenCache.value
  const { rows } = await query('SELECT whatsapp_token FROM tenants WHERE id = $1', [tenantId])
  _waTokenCache = { value: rows[0]?.whatsapp_token || null, at: Date.now() }
  return _waTokenCache.value
}

// Historial de conversaciones por número (en memoria, se limpia al reiniciar)
const conversaciones = new Map()
const MAX_HISTORIAL = 10

// ── Catálogo completo Marquéz ─────────────────────────────────────────────────
const CATALOGO = `
🥐 *MENÚ MARQUÉZ PANADERÍA & REPOSTERÍA*

🧆 *SALADOS*
• Pico de queso - C$20
• Maleta de carne - C$35
• Maleta de pollo - C$30
• Empanada de queso - C$20
• Churro de queso - C$20
• Pan pizza - C$40
• Choripán - C$30

🍩 *PAN DULCE*
• Prisionero - C$25
• Quesadilla - C$30
• Trenza frita - C$20
• Repollito - C$20
• Repodona - C$35
• Berlinesa - C$35
• Rol de canela - C$35
• Chemi - C$25

🍩 *DONAS*
• Dona azucarada - C$20
• Dona de chocolate - C$35
• Dona glaseada - C$35

🥐 *HOJALDRE*
• Pañuelo de piña - C$30
• Pañuelo dulce de leche - C$35
• Bolovan - C$50
• Croissant - C$50
• Flor de hojaldre - C$40
• Mil hojas - C$120
• Palmeritas - C$60

🍰 *TORTAS*
• Torta de naranja - C$35
• Torta de vainilla - C$30
• Torta de chocolate - C$40

🎂 *RINES*
• Rin de vainilla - C$150
• Rin de naranja - C$160
• Rin de chocolate - C$190

🍮 *POSTRES*
• Volteado de piña 2oz - C$75
• Volteado de piña 4oz - C$170
• Volteado de piña ½lb - C$320

🍰 *CHEESECAKES*
• Maracuyá (porción) - C$120 | (libra) - C$1,250
• Fresa (porción) - C$140 | (libra) - C$1,300
• Oreo (porción) - C$120 | (libra) - C$1,250

🧁 *CUPCAKES*
• Vainilla - C$25
• Chocolate - C$30

🍪 *GALLETAS*
• Avena - C$20
• Mantequilla - C$20
• Margarita - C$20
• Coco - C$35
• Chocochips - C$40
`

const SYSTEM_BOT = `Eres el asistente virtual de Marquéz Panadería & Repostería en Nicaragua.
Eres amable, eficiente y orientado a ventas. Respondes SIEMPRE en español.
Usas emojis con moderación para hacer la conversación más amena.
Moneda: Córdobas nicaragüenses (C$).

CATÁLOGO COMPLETO:
${CATALOGO}

REGLAS:
1. Nunca inventes precios — solo usa los del catálogo.
2. Cuando el cliente quiera pedir, confirma: producto, cantidad y nombre.
3. Para pedidos de delivery pregunta la dirección.
4. Si preguntan por algo que no está en el menú, di amablemente que no está disponible.
5. Respuestas cortas y directas — máximo 3-4 líneas por respuesta.
6. Si el cliente saluda, saluda de vuelta y ofrece el menú.
7. Al confirmar un pedido, da el total y di que pronto le contactarán para coordinar.

COMANDOS ESPECIALES que debes detectar:
- Si el cliente escribe "menu", "menú" o "ver productos" → muestra el catálogo completo
- Si escribe "hola", "buenas", "buenos días/tardes/noches" → saluda y pregunta cómo puedes ayudar
- Si escribe "horario" → responde: "Estamos abiertos de lunes a sábado de 6am a 7pm 🕕"
- Si escribe "ubicacion" o "dirección" → responde que te ubiques por WhatsApp para coordinar`

// ── Función: enviar mensaje a WhatsApp ────────────────────────────────────────
async function enviarMensaje(telefono, texto, tenantId) {
  const token = await getWAToken(tenantId)
  if (!token || !getWAPhoneId()) {
    console.warn('[WhatsApp] Token o Phone ID no configurados')
    return
  }

  const res = await fetch(getWAAPI(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
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
    console.error('[WhatsApp] Error al enviar:', JSON.stringify(data))
    const err = new Error(data.error?.message || 'Error al enviar mensaje')
    err.status = res.status
    err.meta = data.error
    throw err
  }
  return data
}

// ── Función: procesar con GPT-4 mini ─────────────────────────────────────────
async function procesarConIA(telefono, mensajeUsuario) {
  if (!process.env.OPENAI_API_KEY) {
    return respuestaFallback(mensajeUsuario)
  }

  // Recuperar o iniciar historial
  if (!conversaciones.has(telefono)) {
    conversaciones.set(telefono, [])
  }
  const historial = conversaciones.get(telefono)

  // Agregar mensaje del usuario
  historial.push({ role: 'user', content: mensajeUsuario })

  // Limitar historial
  if (historial.length > MAX_HISTORIAL) {
    historial.splice(0, historial.length - MAX_HISTORIAL)
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_BOT },
      ...historial,
    ],
    max_tokens: 300,
    temperature: 0.7,
  })

  const respuesta = res.choices[0].message.content

  // Guardar respuesta en historial
  historial.push({ role: 'assistant', content: respuesta })
  conversaciones.set(telefono, historial)

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
router.get('/webhook', (req, res) => {
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
router.post('/webhook', async (req, res) => {
  // Responder 200 inmediatamente para que Meta no reintente
  res.status(200).send('OK')

  try {
    const body = req.body
    if (body.object !== 'whatsapp_business_account') return

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

          // Procesar con IA
          const respuesta = await procesarConIA(telefono, texto)

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
router.post('/enviar', requireAuth, async (req, res, next) => {
  const { telefono, mensaje } = req.body
  if (!telefono || !mensaje) {
    return res.status(400).json({ error: 'telefono y mensaje son requeridos' })
  }
  try {
    const data = await enviarMensaje(telefono, mensaje, req.tenantId)
    if (!data) return res.status(503).json({ error: 'whatsapp_token no configurado en tenants' })
    res.json({ ok: true, data })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, meta: e.meta || null })
  }
})

// ── Endpoint: ver historial de conversación ───────────────────────────────────
router.get('/conversacion/:telefono', requireAuth, (req, res) => {
  const historial = conversaciones.get(req.params.telefono) || []
  res.json({ telefono: req.params.telefono, mensajes: historial.length, historial })
})

// ── Endpoint: limpiar historial ───────────────────────────────────────────────
router.delete('/conversacion/:telefono', requireAuth, (req, res) => {
  conversaciones.delete(req.params.telefono)
  res.json({ ok: true, mensaje: 'Historial limpiado' })
})

// ── Endpoint: status del bot ──────────────────────────────────────────────────
router.get('/status', requireAuth, async (req, res) => {
  const token = await getWAToken(req.tenantId)
  res.json({
    activo:         !!token && !!getWAPhoneId(),
    phone_id:       getWAPhoneId() || 'No configurado',
    token_preview:  token ? token.slice(0, 8) + '...' : 'NO CONFIGURADO',
    ia_activa:      !!process.env.OPENAI_API_KEY,
    modelo:         'gpt-4o-mini',
    conversaciones: conversaciones.size,
    verify_token:   VERIFY_TOKEN,
  })
})

export default router
