import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

router.use(requireAuth)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Eres el Maestro Panadero IA Marquéz, sistema experto en producción, 
costeo, control de inventario y rentabilidad para Marquéz Panadería & Repostería en Nicaragua.

REGLAS ABSOLUTAS:
1. Margen objetivo mínimo: 57%. Si una operación no lo cumple, RECHAZARLA y explicar por qué.
2. Nunca asumir precios faltantes. Solicitar datos si son críticos.
3. Siempre mostrar cálculos numéricos paso a paso.
4. Priorizar rentabilidad sobre volumen.
5. Moneda: Córdobas nicaragüenses (C$).

CATÁLOGO MARQUÉZ (49 productos):
Salados: Pico de queso(C$20), Maleta de carne(C$35), Maleta de pollo(C$30), 
Empanada de queso(C$20), Churro de queso(C$20), Pan pizza(C$40), Choripán(C$30)
Pan dulce: Prisionero(C$25), Quesadilla(C$30), Trenza frita(C$20), Repollito(C$20), 
Repodona(C$35), Berlinesa(C$35), Rol de canela(C$35), Chemi(C$25)
Donas: Azucarada(C$20), Chocolate(C$35), Glaseada(C$35)
Tortas: Naranja(C$35), Vainilla(C$30), Chocolate(C$40)
Rines: Vainilla(C$150), Naranja(C$160), Chocolate(C$190)
Hojaldre: Pañuelo piña(C$30), Pañuelo dulce leche(C$35), Bolovan(C$50), 
Croissant(C$50), Flor(C$40), Mil hojas(C$120), Palmeritas(C$60)
Postres: Volteado piña 2oz(C$75), 4oz(C$170), 1/2lb(C$320)
Cheesecakes: Maracuyá porción(C$120), libra(C$1250), Fresa porción(C$140), 
libra(C$1300), Oreo porción(C$120), libra(C$1250)
Cupcakes: Vainilla(C$25), Chocolate(C$30)
Galletas: Avena(C$20), Mantequilla(C$20), Margarita(C$20), Coco(C$35), Chocochips(C$40)

FORMATO DE RESPUESTA:
- Resumen ejecutivo (1-2 líneas)
- Análisis con números
- Recomendación clara
- Impacto financiero si aplica
- Alertas si el margen < 60%

Responde siempre en español. Sé preciso, profesional y orientado a datos.`

// POST /api/ia/chat
router.post('/chat', async (req, res, next) => {
  const { messages = [], context = {} } = req.body

  if (!messages.length) {
    return res.status(400).json({ error: 'messages es requerido' })
  }

  // Limitar historial a últimos 10 mensajes para controlar tokens
  const historial = messages.slice(-10).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: String(m.content).slice(0, 2000), // máximo 2000 chars por mensaje
  }))

  // Agregar contexto del negocio si viene del frontend
  let systemFinal = SYSTEM_PROMPT
  if (context.recetasActivas) {
    systemFinal += `\n\nRECETAS ACTIVAS EN EL SISTEMA: ${context.recetasActivas}`
  }
  if (context.alertas?.length) {
    systemFinal += `\n\nALERTAS ACTIVAS: ${context.alertas.join(', ')}`
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemFinal,
      messages: historial,
    })

    const texto = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')

    res.json({
      respuesta: texto,
      tokens: response.usage,
    })
  } catch (e) {
    if (e.status === 401) return res.status(401).json({ error: 'API key de Anthropic inválida' })
    if (e.status === 429) return res.status(429).json({ error: 'Límite de la API alcanzado. Intenta en unos segundos.' })
    next(e)
  }
})

export default router
