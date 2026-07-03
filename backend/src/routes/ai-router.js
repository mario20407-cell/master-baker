import { Router } from 'express'
import {
  chatCliente,
  logicaNegocio,
  costeoMasivo,
  analisisRazon,
  multimedia,
  getProvidersStatus,
  AI_CONFIG,
} from '../services/ai/aiProvider.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

router.use(requireAuth)

// ── Clasificador de tareas ────────────────────────────────────────────────────
const TASK_TYPES = {
  CHAT_CLIENTE:    'chat_cliente',    // GPT-4 mini
  LOGICA_NEGOCIO:  'logica_negocio',  // Claude 3.5 Sonnet
  COSTEO_MASIVO:   'costeo_masivo',   // DeepSeek V3
  ANALISIS_RAZON:  'analisis_razon',  // DeepSeek R1
  MULTIMEDIA:      'multimedia',      // Gemini 2.5 Flash
}

function clasificarTarea(tipo) {
  const mapa = {
    'whatsapp':    TASK_TYPES.CHAT_CLIENTE,
    'chat':        TASK_TYPES.CHAT_CLIENTE,
    'menu':        TASK_TYPES.CHAT_CLIENTE,
    'pedido':      TASK_TYPES.CHAT_CLIENTE,
    'margen':      TASK_TYPES.LOGICA_NEGOCIO,
    'decision':    TASK_TYPES.LOGICA_NEGOCIO,
    'inventario':  TASK_TYPES.LOGICA_NEGOCIO,
    'alerta':      TASK_TYPES.LOGICA_NEGOCIO,
    'costeo':      TASK_TYPES.COSTEO_MASIVO,
    'escalado':    TASK_TYPES.COSTEO_MASIVO,
    'lote':        TASK_TYPES.COSTEO_MASIVO,
    'compras':     TASK_TYPES.COSTEO_MASIVO,
    'razonamiento':TASK_TYPES.ANALISIS_RAZON,
    'optimizar':   TASK_TYPES.ANALISIS_RAZON,
    'pdf':         TASK_TYPES.MULTIMEDIA,
    'imagen':      TASK_TYPES.MULTIMEDIA,
    'foto':        TASK_TYPES.MULTIMEDIA,
    'factura':     TASK_TYPES.MULTIMEDIA,
    'manual':      TASK_TYPES.MULTIMEDIA,
    'receta_img':  TASK_TYPES.MULTIMEDIA,
  }
  return mapa[tipo?.toLowerCase()] || TASK_TYPES.LOGICA_NEGOCIO
}

// ── Prompts de sistema por dominio ────────────────────────────────────────────
const SYSTEM_PROMPTS = {
  [TASK_TYPES.CHAT_CLIENTE]: `Eres el asistente virtual de Marquéz Panadería & Repostería en Nicaragua.
Eres amable, conciso y orientado a ventas. Respondes en español.
Conoces el menú completo, precios y puedes tomar pedidos.
Cuando el cliente quiere pedir, confirma: producto, cantidad, nombre y método de entrega.
Nunca inventes precios — usa solo los del catálogo.
CATÁLOGO RESUMIDO (precios en C$):
Pan dulce: Prisionero 25, Repodona 35, Berlinesa 35, Rol de canela 35
Salados: Pico de queso 20, Maleta de carne 35, Maleta de pollo 30, Pan pizza 40
Donas: Azucarada 20, Chocolate 35, Glaseada 35
Hojaldre: Croissant 50, Mil hojas 120, Palmeritas 60
Cheesecakes: Maracuyá porción 120, Fresa porción 140, Oreo porción 120
Galletas: Avena 20, Chocochips 40, Coco 35
Postres: Volteado piña 2oz 75, 4oz 170`,

  [TASK_TYPES.LOGICA_NEGOCIO]: `Eres el sistema experto de lógica de negocio de Marquéz Panadería & Repostería Nicaragua.
Margen objetivo mínimo: 57%. Si una operación viola este margen, RECHAZARLA con explicación.
Moneda: Córdobas nicaragüenses (C$).
Eres preciso, orientado a datos y proteges la rentabilidad del negocio.
Formato: Resumen → Análisis numérico → Recomendación → Impacto financiero.
Nunca asumas precios faltantes. Si faltan datos críticos, pídelos.`,

  [TASK_TYPES.COSTEO_MASIVO]: `Eres un motor de costeo y escalado masivo para Marquéz Panadería & Repostería Nicaragua.
Especialidad: procesar múltiples recetas simultáneamente, escalar lotes y optimizar compras.
Margen objetivo: 57%. Moneda: C$ (Córdobas).
Para cada receta calcula: costo total, costo unitario, precio mínimo de venta y margen neto.
Responde siempre con datos estructurados en JSON cuando se te pida.
Formato JSON de costeo: { producto, piezas, costo_total, costo_unitario, precio_minimo, margen_pct, aprobado }`,

  [TASK_TYPES.ANALISIS_RAZON]: `Eres un analista de optimización y razonamiento profundo para Marquéz Panadería Nicaragua.
Tu especialidad es encontrar oportunidades de ahorro, optimizar rutas de compra y
razonar sobre decisiones complejas de producción y rentabilidad.
Usa razonamiento paso a paso. Muestra tu cadena de pensamiento antes de concluir.
Moneda: C$ (Córdobas). Margen objetivo: 57%.`,
}

// ── Endpoints del router ──────────────────────────────────────────────────────

// POST /api/ai/chat — chat general con routing automático
router.post('/chat', async (req, res, next) => {
  const { messages = [], tipo = 'logica_negocio', context = {}, datos } = req.body
  if (!messages.length) return res.status(400).json({ error: 'messages requerido' })

  const taskType = clasificarTarea(tipo)
  const system = SYSTEM_PROMPTS[taskType]

  try {
    let resultado
    switch (taskType) {
      case TASK_TYPES.CHAT_CLIENTE:
        resultado = await chatCliente(messages, system)
        break
      case TASK_TYPES.COSTEO_MASIVO:
        resultado = await costeoMasivo(messages, system, datos)
        break
      case TASK_TYPES.ANALISIS_RAZON:
        resultado = await analisisRazon(messages, system)
        break
      default:
        resultado = await logicaNegocio(messages, system, context)
    }
    res.json({ ...resultado, taskType })
  } catch (e) {
    // Fallback: si el modelo principal falla, usar Claude (lógica de negocio)
    if (taskType !== TASK_TYPES.LOGICA_NEGOCIO) {
      try {
        console.warn(`[AI Router] Fallback a Claude desde ${taskType}:`, e.message)
        const resultado = await logicaNegocio(
          messages,
          SYSTEM_PROMPTS[TASK_TYPES.LOGICA_NEGOCIO],
          context
        )
        return res.json({ ...resultado, taskType, fallback: true })
      } catch (e2) { return next(e2) }
    }
    next(e)
  }
})

// POST /api/ai/costeo-masivo — costear múltiples recetas de una vez
router.post('/costeo-masivo', async (req, res, next) => {
  const { recetas = [], margenObjetivo = 57 } = req.body
  if (!recetas.length) return res.status(400).json({ error: 'recetas requeridas' })

  const prompt = `Calcula el costeo completo para estas ${recetas.length} recetas de panadería.
Margen objetivo: ${margenObjetivo}%.
Para cada una devuelve JSON con: producto, costo_total, costo_unitario, precio_minimo, margen_pct, aprobado.
Devuelve SOLO un array JSON, sin explicaciones adicionales.`

  try {
    const resultado = await costeoMasivo(
      [{ role: 'user', content: prompt }],
      SYSTEM_PROMPTS[TASK_TYPES.COSTEO_MASIVO],
      recetas
    )
    const txt = resultado.respuesta.replace(/```json|```/g, '').trim()
    let costeos
    try { costeos = JSON.parse(txt) } catch { costeos = resultado.respuesta }
    res.json({ costeos, modelo: resultado.modelo, tokens: resultado.tokens })
  } catch (e) { next(e) }
})

// POST /api/ai/analizar-pdf — extraer datos de PDF o imagen con Gemini
router.post('/analizar-pdf', async (req, res, next) => {
  const { fileBase64, mimeType, tipo = 'receta' } = req.body
  if (!fileBase64) return res.status(400).json({ error: 'fileBase64 requerido' })

  const prompts = {
    receta: `Extrae todos los ingredientes de esta receta con sus cantidades exactas.
Devuelve JSON: { nombre_receta, piezas_base, ingredientes: [{nombre, cantidad, unidad}] }
Solo JSON, sin texto adicional.`,
    factura: `Extrae todos los productos de esta factura de compra con precios.
Devuelve JSON: { proveedor, fecha, items: [{producto, cantidad, precio_unitario}], total }
Solo JSON, sin texto adicional.`,
    manual: `Analiza este manual o documento de panadería. Resume:
1. Proceso o receta principal
2. Ingredientes y cantidades si aparecen
3. Puntos clave de la técnica
4. Temperaturas y tiempos si se mencionan`,
  }

  try {
    const resultado = await multimedia(prompts[tipo] || prompts.manual, fileBase64, mimeType)
    let datos = resultado.respuesta
    if (tipo !== 'manual') {
      try {
        datos = JSON.parse(resultado.respuesta.replace(/```json|```/g, '').trim())
      } catch {}
    }
    res.json({ datos, modelo: resultado.modelo })
  } catch (e) { next(e) }
})

// POST /api/ai/whatsapp — endpoint específico para el bot de WhatsApp
router.post('/whatsapp', async (req, res, next) => {
  const { mensaje, historial = [] } = req.body
  if (!mensaje) return res.status(400).json({ error: 'mensaje requerido' })

  const messages = [...historial.slice(-6), { role: 'user', content: mensaje }]

  try {
    const resultado = await chatCliente(messages, SYSTEM_PROMPTS[TASK_TYPES.CHAT_CLIENTE])
    res.json({ respuesta: resultado.respuesta, modelo: resultado.modelo })
  } catch (e) { next(e) }
})

// GET /api/ai/status — estado de cada modelo/API key (real o mock)
router.get('/status', (req, res) => {
  res.json({
    modoMock: AI_CONFIG.USE_MOCKS,
    modelos: getProvidersStatus(),
    margenObjetivo: 57,
    negocio: 'Marquéz Panadería & Repostería',
  })
})

export default router
