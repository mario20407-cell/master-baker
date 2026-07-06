// src/services/ai/aiProvider.js
//
// Capa única de acceso a los modelos de IA.
// v2.7.1 — Optimización de tokens:
//   - Clasificador de complejidad: simple (300 tokens) vs complejo (1024)
//   - Historial reducido: 4 mensajes para simple, 6 para complejo
//   - System prompt comprimido sin redundancias
//   - Modelo corregido: claude-sonnet-5

import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const AI_CONFIG = {
  USE_MOCKS: false,
}

// ── Clientes ──────────────────────────────────────────────────────────────────
const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurada')
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const getAnthropic = () => {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY no configurada')
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

const getDeepSeek = () => {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY no configurada')
  return new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com/v1' })
}

const getGemini = () => {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no configurada')
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim())
}

// ── Clasificador de complejidad ───────────────────────────────────────────────
// Decide cuántos tokens y mensajes de historial usar.
// Simple: preguntas cortas, cálculos directos → 300 tokens, 4 mensajes
// Complejo: recetas, análisis, comparaciones → 1024 tokens, 6 mensajes
const PALABRAS_COMPLEJAS = [
  'receta', 'ingrediente', 'analiza', 'compara', 'optimiza',
  'estrategia', 'recomendación', 'explica', 'detalla', 'plan',
  'semana', 'mes', 'lote', 'escalado', 'todos', 'lista',
]

function clasificarComplejidad(messages) {
  const ultimo = String(messages?.[messages.length - 1]?.content || '').toLowerCase()
  const esComplejo = PALABRAS_COMPLEJAS.some(p => ultimo.includes(p)) || ultimo.length > 120
  return {
    max_tokens:    esComplejo ? 1024 : 300,
    historial:     esComplejo ? 6    : 4,
  }
}

// ── Mock helper ───────────────────────────────────────────────────────────────
function mockLog(modelo, messages) {
  const ultimo = messages?.[messages.length - 1]?.content || ''
  console.log(`[MOCK] ${modelo} ← "${String(ultimo).slice(0, 60)}..."`)
}

// ── System prompt comprimido para Marquéz ────────────────────────────────────
// Versión reducida: mismo contexto, ~40% menos tokens que el original.
const SYSTEM_MARQUEZ = `Eres el asesor de negocio de Marquéz Panadería & Repostería, Chinandega, Nicaragua.

REGLAS DE NEGOCIO:
- Margen mínimo 57% (FACTOR_COSTO_MAX=0.43). Moneda: córdobas (C$). 49 productos.
- Fórmulas: margen=((pventa-costo)/pventa)*100 | precio_mínimo=costo/0.43
- Régimen fiscal: Cuota Fija DGI o Régimen General. Prorrateo = cuota_mensual/unidades_mes.

SEMÁFORO DE MARGEN:
- margen < 57% → ALERTA CRÍTICA + precio mínimo requerido
- margen 57-60% → APROBADO, advertir colchón estrecho
- margen > 60% → APROBADO, margen saludable

RECETAS BASE (cuando el usuario no tiene una):
- Puedes sugerir recetas orientativas de panadería nicaragüense para 100 piezas.
- Da ingredientes con cantidades en kg o g, claras y prácticas.
- Incluye: harina, azúcar, mantequilla/margarina, huevos, levadura, sal y los específicos del producto.
- Siempre aclara: "Estas cantidades son de referencia — ajústalas según tu horno y proceso."
- Después de dar la receta, ofrece costearla si el usuario comparte los precios de sus ingredientes.

PRODUCTOS DEL CATÁLOGO (referencia):
Pan dulce: Prisionero, Repodona, Berlinesa, Rol de canela, Empanada de queso, Churro de queso, Quesadilla, Semita
Salados: Pico de queso, Maleta de carne, Maleta de pollo, Pan pizza, Enrollado de jamón
Donas: Azucarada, Chocolate, Glaseada
Hojaldre: Croissant, Mil hojas, Palmeritas, Napoleón
Pasteles: Pastel de piña, Pastel de pollo, Volteado de piña
Cheesecakes, Galletas, Rines, Tortas, Postres, Cupcakes

TONO: directo, en español nicaragüense, con números concretos. Sin preámbulos innecesarios.`

// ═══════════════════════════════════════════════════════════════════════════════
// chatCliente — GPT-4o mini (WhatsApp)
// ═══════════════════════════════════════════════════════════════════════════════
export async function chatCliente(messages, system) {
  if (AI_CONFIG.USE_MOCKS) {
    mockLog('gpt-4o-mini', messages)
    return {
      respuesta: `[MOCK GPT-4o mini] Respuesta simulada.`,
      modelo: 'gpt-4o-mini (mock)',
      tokens: { input_tokens: 0, output_tokens: 0 },
    }
  }

  const { max_tokens, historial } = clasificarComplejidad(messages)
  const client = getOpenAI()
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: system }, ...messages.slice(-historial)],
    max_tokens,
    temperature: 0.7,
  })
  return {
    respuesta: res.choices[0].message.content,
    modelo: 'gpt-4o-mini',
    tokens: res.usage,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// logicaNegocio — Claude Sonnet 4.6 (reglas de negocio, márgenes, decisiones)
// ═══════════════════════════════════════════════════════════════════════════════
export async function logicaNegocio(messages, system, context = {}) {
  if (AI_CONFIG.USE_MOCKS) {
    mockLog('claude-sonnet-5', messages)
    return {
      respuesta: `[MOCK Claude Sonnet 3.5] Respuesta simulada. Margen objetivo: 57%.`,
      modelo: 'claude-sonnet-5 (mock)',
      tokens: { input_tokens: 0, output_tokens: 0 },
    }
  }

  const { max_tokens, historial } = clasificarComplejidad(messages)
  const client = getAnthropic()

  // System prompt comprimido + contexto opcional
  let systemFinal = system || SYSTEM_MARQUEZ
  if (context?.recetas) systemFinal += `\nRECETAS: ${context.recetas}`
  if (context?.alertas) systemFinal += `\nALERTAS: ${context.alertas}`

  const res = await client.messages.create({
    model:      'claude-sonnet-5',
    max_tokens,
    system:     systemFinal,
    messages:   messages.slice(-historial),
  })

  return {
    respuesta: res.content.filter(b => b.type === 'text').map(b => b.text).join('\n'),
    modelo:    'claude-sonnet-5',
    tokens:    res.usage,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// costeoMasivo — Claude 3.5 Sonnet (temporalmente, en lugar de DeepSeek V3)
// NOTA: DEEPSEEK_API_KEY no está configurada. Redirigido a Anthropic para evitar
// que el botón "Costeo masivo" muestre error al usuario. Revertir cuando haya
// presupuesto para DeepSeek.
// ═══════════════════════════════════════════════════════════════════════════════
export async function costeoMasivo(messages, system, datos) {
  if (AI_CONFIG.USE_MOCKS) {
    mockLog('claude-sonnet-5 (costeo)', messages)
    const costeosSimulados = Array.isArray(datos)
      ? datos.map((r, i) => ({
          producto:      r.producto || r.n || `Producto ${i + 1}`,
          costo_total:   0,
          costo_unitario: 0,
          precio_minimo: 0,
          margen_pct:    57,
          aprobado:      true,
          nota:          'Mock — sin GEMINI/DEEPSEEK',
        }))
      : null
    return {
      respuesta: costeosSimulados ? JSON.stringify(costeosSimulados) : '[MOCK Claude costeo]',
      modelo:    'claude-sonnet-5 (mock)',
      tokens:    { input_tokens: 0, output_tokens: 0 },
    }
  }

  const client = getAnthropic()
  const prompt = datos
    ? `${messages[messages.length - 1].content}\n\nDATOS:\n${JSON.stringify(datos, null, 2)}`
    : messages[messages.length - 1].content

  const res = await client.messages.create({
    model:      'claude-sonnet-5',
    max_tokens: 2048,
    system:     system,
    messages:   [...messages.slice(-5, -1), { role: 'user', content: prompt }],
  })
  return {
    respuesta: res.content.filter(b => b.type === 'text').map(b => b.text).join('\n'),
    modelo:    'claude-sonnet-5',
    tokens:    res.usage,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// analisisRazon — Claude 3.5 Sonnet (temporalmente, en lugar de DeepSeek R1)
// NOTA: DEEPSEEK_API_KEY no está configurada. Redirigido a Anthropic para evitar
// que el botón "Análisis profundo" muestre error al usuario. Revertir cuando haya
// presupuesto para DeepSeek. Claude no expone un campo de "razonamiento" separado
// como DeepSeek R1, así que se pide explícitamente en el prompt y se devuelve
// razonamiento: null (el frontend ya maneja ese campo como opcional).
// ═══════════════════════════════════════════════════════════════════════════════
export async function analisisRazon(messages, system) {
  if (AI_CONFIG.USE_MOCKS) {
    mockLog('claude-sonnet-5 (analisis)', messages)
    return {
      respuesta:     '[MOCK Claude análisis] Análisis simulado.',
      razonamiento:  null,
      modelo:        'claude-sonnet-5 (mock)',
      tokens:        { input_tokens: 0, output_tokens: 0 },
    }
  }

  const client = getAnthropic()
  const systemFinal = `${system}\n\nPiensa paso a paso antes de responder y estructura tu respuesta con tu razonamiento seguido de la conclusión.`
  const res = await client.messages.create({
    model:      'claude-sonnet-5',
    max_tokens: 2048,
    system:     systemFinal,
    messages:   messages.slice(-6),
  })
  return {
    respuesta:    res.content.filter(b => b.type === 'text').map(b => b.text).join('\n'),
    razonamiento: null,
    modelo:       'claude-sonnet-5',
    tokens:       res.usage,
  }
}

export async function multimedia(prompt, fileData, mimeType) {
  if (AI_CONFIG.USE_MOCKS) {
    console.log(`[MOCK] gemini-2.0-flash ← "${prompt.slice(0, 60)}"`)
    return {
      respuesta: JSON.stringify({ mock: true, nota: 'Sin GEMINI_API_KEY.' }),
      modelo:    'gemini-2.0-flash (mock)',
    }
  }

  try {
    const key = process.env.GEMINI_API_KEY.trim()
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${key}`
    
    const parts = [{ text: prompt }]
    if (fileData) {
      parts.push({ inlineData: { mimeType: mimeType || 'application/pdf', data: fileData } })
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts }] })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Google API status ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!txt) throw new Error('No text returned in Gemini response')

    return {
      respuesta: txt,
      modelo:    'gemini-2.0-flash',
    }
  } catch (err) {
    console.warn('[multimedia] Error con Gemini, intentando fallback con OpenAI (GPT-4o mini):', err.message)
    
    if (process.env.OPENAI_API_KEY && fileData && mimeType && mimeType.startsWith('image/')) {
      try {
        const openai = getOpenAI()
        const res = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${fileData}`,
                  }
                }
              ]
            }
          ],
          max_tokens: 1024,
        })
        return {
          respuesta: res.choices[0].message.content,
          modelo:    'gpt-4o-mini (fallback OCR)',
        }
      } catch (openAiErr) {
        console.error('[multimedia] Fallback de OpenAI también falló:', openAiErr.message)
        throw err
      }
    }
    throw err
  }
}

// ── Estado de proveedores ─────────────────────────────────────────────────────
export function getProvidersStatus() {
  return {
    'claude-sonnet-5': {
      activo:  AI_CONFIG.USE_MOCKS ? 'mock' : !!process.env.ANTHROPIC_API_KEY,
      uso:     'Lógica de negocio, márgenes, decisiones',
      costo:   '~$0.003/1K tokens',
      keyVar:  'ANTHROPIC_API_KEY',
    },
    'gpt-4o-mini': {
      activo:  AI_CONFIG.USE_MOCKS ? 'mock' : !!process.env.OPENAI_API_KEY,
      uso:     'Chat WhatsApp, atención al cliente',
      costo:   '~$0.00015/1K tokens',
      keyVar:  'OPENAI_API_KEY',
    },
    'deepseek-v3': {
      activo:  AI_CONFIG.USE_MOCKS ? 'mock' : !!process.env.DEEPSEEK_API_KEY,
      uso:     'Costeo masivo, escalado de recetas',
      costo:   '~$0.00027/1K tokens',
      keyVar:  'DEEPSEEK_API_KEY',
    },
    'deepseek-r1': {
      activo:  AI_CONFIG.USE_MOCKS ? 'mock' : !!process.env.DEEPSEEK_API_KEY,
      uso:     'Análisis profundo, optimización',
      costo:   '~$0.00055/1K tokens',
      keyVar:  'DEEPSEEK_API_KEY',
    },
    'gemini-2.0-flash': {
      activo:  AI_CONFIG.USE_MOCKS ? 'mock' : !!process.env.GEMINI_API_KEY,
      uso:     'PDFs, imágenes, facturas escaneadas',
      costo:   '~$0.000075/1K tokens',
      keyVar:  'GEMINI_API_KEY',
    },
  }
}

export default { AI_CONFIG, chatCliente, logicaNegocio, costeoMasivo, analisisRazon, multimedia, getProvidersStatus }
