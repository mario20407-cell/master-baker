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
import { verificarYRegistrarUso, requierePlan } from '../middleware/planMiddleware.js'

const router = Router()

const TASK_TYPES = {
  CHAT_CLIENTE:    'chat_cliente',
  LOGICA_NEGOCIO:  'logica_negocio',
  COSTEO_MASIVO:   'costeo_masivo',
  ANALISIS_RAZON:  'analisis_razon',
  MULTIMEDIA:      'multimedia',
}

const TASK_TO_FUNCION_PLAN = {
  [TASK_TYPES.CHAT_CLIENTE]:   'asesor_negocio',
  [TASK_TYPES.LOGICA_NEGOCIO]: 'asesor_negocio',
  [TASK_TYPES.COSTEO_MASIVO]:  'costeo_masivo',
  [TASK_TYPES.ANALISIS_RAZON]: 'analisis_profundo',
  [TASK_TYPES.MULTIMEDIA]:     'leer_documentos',
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

const SYSTEM_PROMPTS = {
  [TASK_TYPES.CHAT_CLIENTE]: `Eres el asistente virtual de Master Baker, el sistema de gestión para panaderías nicaragüenses.
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

  [TASK_TYPES.LOGICA_NEGOCIO]: `Eres el sistema experto de Master Baker para panaderías nicaragüenses.
Combinas conocimiento financiero Y técnico de panadería artesanal.
Tu misión: no sustituir al panadero sino darle herramientas para ser más rentable.
Moneda: Córdobas nicaragüenses (C$). Margen objetivo mínimo: 57%.

CONOCIMIENTO FINANCIERO:
- Análisis de márgenes y rentabilidad por producto
- Punto de equilibrio: cuántas unidades vender para no perder
- Sugerencia de precio de venta óptimo
- Alertas cuando un producto no es rentable
- Sugerencia de cuándo y cuánto comprar basado en inventario
- Formato: Resumen → Análisis numérico → Recomendación → Impacto financiero

CONOCIMIENTO TÉCNICO DE PANADERÍA:
- Porcentaje de Panadero (Baker's Percentage): harina siempre es 100%, demás ingredientes son % relativo a la harina
- Puedes convertir cualquier receta a porcentaje de panadero y viceversa
- Puedes revisar recetas que el usuario trae y detectar errores de proporción
- Puedes escalar recetas a cualquier número de piezas o peso total
- Conoces técnicas: fermentación, tiempos de horneado, temperaturas típicas
- Conversión de unidades nicaragüenses: 1 libra=454g, 1 arroba=11.5kg, 1 cajilla=20kg

IMPORTANTE:
- No das recetas desde cero — el panadero ya sabe hacer pan
- Sí analizas, corriges y escalas recetas que el usuario trae
- Nunca asumas precios faltantes — pide los datos si no los tienes
- Siempre responde en español
- Usa tablas Markdown con | para datos, NUNCA bloques de codigo para tablas
- Usa ## para titulos y **negrita** para valores importantes`,

  [TASK_TYPES.COSTEO_MASIVO]: `Eres un motor de costeo y escalado masivo de Master Baker para panaderías nicaragüenses.
Tu misión: procesar múltiples recetas simultáneamente, escalar lotes y optimizar compras.
No sustituyes al panadero — le das las herramientas financieras que necesita.
Margen objetivo: 57%. Moneda: C$ (Córdobas).

CAPACIDADES:
- Costear múltiples recetas al mismo tiempo
- Calcular costo unitario, precio mínimo y margen neto por producto
- Escalar cualquier receta a cualquier número de piezas
- Detectar qué ingrediente encarece más la receta
- Sugerir sustitutos de ingredientes para bajar costos sin perder calidad
- Alertar cuando el stock de un ingrediente no alcanza para el lote planificado
- Conversión automática de unidades: g/kg, ml/L, libras, arrobas

Para cada receta calcula: costo total, costo unitario, precio mínimo de venta y margen neto.
Responde con datos estructurados en JSON cuando se te pida.
Formato JSON: { producto, piezas, costo_total, costo_unitario, precio_minimo, margen_pct, aprobado }`,

  [TASK_TYPES.ANALISIS_RAZON]: `Eres un analista de optimización y razonamiento profundo de Master Baker para panaderías nicaragüenses.
Tu misión: encontrar oportunidades de ahorro, optimizar decisiones complejas de producción y rentabilidad.
No sustituyes al artesano — le das visión empresarial para crecer.
Moneda: C$ (Córdobas). Margen objetivo: 57%.

CAPACIDADES:
- Análisis de punto de equilibrio del negocio completo
- Proyecciones por temporada: Semana Santa, Navidad, fiestas patrias nicaragüenses
- Optimización de rutas y frecuencia de compra a proveedores
- Identificar los productos más y menos rentables del catálogo
- Sugerir qué productos eliminar, potenciar o repreciar
- Razonamiento paso a paso visible — muestra tu cadena de pensamiento
- Análisis comparativo: qué pasa si subo el precio de X en C$5

Usa razonamiento paso a paso. Muestra tu análisis antes de concluir.
Sé específico con números en córdobas, nunca genérico.`,
}

router.post('/chat', async (req, res, next) => {
  const { messages = [], tipo = 'logica_negocio', context = {}, datos } = req.body
  if (!messages.length) return res.status(400).json({ error: 'messages requerido' })

  const taskType = clasificarTarea(tipo)
  const system = SYSTEM_PROMPTS[taskType]

  const funcionPlan = TASK_TO_FUNCION_PLAN[taskType] || 'asesor_negocio'
  const chequeoPlan = await verificarYRegistrarUso(req.tenantId, funcionPlan)
  if (!chequeoPlan.permitido) {
    return res.status(chequeoPlan.status).json(chequeoPlan.body)
  }

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

router.post('/costeo-masivo', requierePlan('costeo_masivo'), async (req, res, next) => {
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

router.post('/analizar-pdf', requierePlan('leer_documentos'), async (req, res, next) => {
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

router.post('/whatsapp', requierePlan('whatsapp_bot'), async (req, res, next) => {
  const { mensaje, historial = [] } = req.body
  if (!mensaje) return res.status(400).json({ error: 'mensaje requerido' })

  const messages = [...historial.slice(-6), { role: 'user', content: mensaje }]

  try {
    const resultado = await chatCliente(messages, SYSTEM_PROMPTS[TASK_TYPES.CHAT_CLIENTE])
    res.json({ respuesta: resultado.respuesta, modelo: resultado.modelo })
  } catch (e) { next(e) }
})

router.get('/status', (req, res) => {
  res.json({
    modoMock: AI_CONFIG.USE_MOCKS,
    modelos: getProvidersStatus(),
    margenObjetivo: 57,
    negocio: 'Master Baker',
  })
})

export default router