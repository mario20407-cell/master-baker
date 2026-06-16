import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const AI_CONFIG = {
  USE_MOCKS: false,
}

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
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
}

const PALABRAS_COMPLEJAS = [
  'receta','ingrediente','analiza','compara','optimiza',
  'estrategia','explica','detalla','plan','semana','mes',
  'lote','escalado','todos','lista',
]

function clasificarComplejidad(messages) {
  const ultimo = String(messages?.[messages.length - 1]?.content || '').toLowerCase()
  const esComplejo = PALABRAS_COMPLEJAS.some(p => ultimo.includes(p)) || ultimo.length > 120
  return { max_tokens: esComplejo ? 1024 : 300, historial: esComplejo ? 6 : 4 }
}

function mockLog(modelo, messages) {
  const ultimo = messages?.[messages.length - 1]?.content || ''
  console.log(`[MOCK] ${modelo} <- "${String(ultimo).slice(0, 60)}..."`)
}

const SYSTEM_MARQUEZ = `Eres el asesor de Marquez Panaderia & Reposteria, Chinandega, Nicaragua.

REGLAS DE NEGOCIO:
- Margen minimo 57% (FACTOR_COSTO_MAX=0.43). Moneda: cordobas (C$). 49 productos.
- Formulas: margen=((pventa-costo)/pventa)*100 | precio_minimo=costo/0.43
- Regimen fiscal: Cuota Fija DGI o Regimen General.

SEMAFORO DE MARGEN:
- margen < 57% -> ALERTA CRITICA + precio minimo requerido
- margen 57-60% -> APROBADO, advertir colchon estrecho
- margen > 60% -> APROBADO, margen saludable

RECETAS BASE:
- Puedes sugerir recetas orientativas de panaderia nicaraguense para 100 piezas.
- Da ingredientes con cantidades en kg o g, claras y practicas.
- Siempre aclara que son cantidades de referencia para ajustar segun horno y proceso.
- Despues ofrece costearla si el usuario da los precios de sus ingredientes.

PRODUCTOS: Pan dulce, Salados, Donas, Hojaldre, Pasteles, Cheesecakes, Galletas, Rines, Tortas, Postres, Cupcakes.

TONO: directo, espanol nicaraguense, numeros concretos, sin preambulos.`

export async function chatCliente(messages, system) {
  if (AI_CONFIG.USE_MOCKS) {
    mockLog('gpt-4o-mini', messages)
    return { respuesta: '[MOCK GPT-4o mini]', modelo: 'gpt-4o-mini (mock)', tokens: { input_tokens: 0, output_tokens: 0 } }
  }
  const { max_tokens, historial } = clasificarComplejidad(messages)
  const client = getOpenAI()
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: system }, ...messages.slice(-historial)],
    max_tokens, temperature: 0.7,
  })
  return { respuesta: res.choices[0].message.content, modelo: 'gpt-4o-mini', tokens: res.usage }
}

export async function logicaNegocio(messages, system, context = {}) {
  if (AI_CONFIG.USE_MOCKS) {
    mockLog('claude-sonnet-4-6', messages)
    return { respuesta: '[MOCK Claude] Margen objetivo: 57%.', modelo: 'claude-sonnet-4-6 (mock)', tokens: { input_tokens: 0, output_tokens: 0 } }
  }
  const { max_tokens, historial } = clasificarComplejidad(messages)
  const client = getAnthropic()
  let systemFinal = system || SYSTEM_MARQUEZ
  if (context?.recetas) systemFinal += `\nRECETAS: ${context.recetas}`
  if (context?.alertas) systemFinal += `\nALERTAS: ${context.alertas}`
  const res = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens,
  system: [
    {
      type: 'text',
      text: systemFinal,
      cache_control: { type: 'ephemeral' },
    }
  ],
  messages: messages.slice(-historial),
})
  return {
    respuesta: res.content.filter(b => b.type === 'text').map(b => b.text).join('\n'),
    modelo: 'claude-sonnet-4-6',
    tokens: res.usage,
  }
}

export async function costeoMasivo(messages, system, datos) {
  if (AI_CONFIG.USE_MOCKS) {
    mockLog('deepseek-v3', messages)
    const sim = Array.isArray(datos) ? datos.map((r, i) => ({ producto: r.producto || `Producto ${i+1}`, costo_total: 0, costo_unitario: 0, precio_minimo: 0, margen_pct: 57, aprobado: true })) : null
    return { respuesta: sim ? JSON.stringify(sim) : '[MOCK DeepSeek V3]', modelo: 'deepseek-v3 (mock)', tokens: { input_tokens: 0, output_tokens: 0 } }
  }
  const client = getDeepSeek()
  const prompt = datos ? `${messages[messages.length-1].content}\n\nDATOS:\n${JSON.stringify(datos,null,2)}` : messages[messages.length-1].content
  const res = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'system', content: system }, ...messages.slice(-5,-1), { role: 'user', content: prompt }],
    max_tokens: 2048, temperature: 0.1,
  })
  return { respuesta: res.choices[0].message.content, modelo: 'deepseek-v3', tokens: res.usage }
}

export async function analisisRazon(messages, system) {
  if (AI_CONFIG.USE_MOCKS) {
    mockLog('deepseek-r1', messages)
    return { respuesta: '[MOCK DeepSeek R1]', razonamiento: '[MOCK]', modelo: 'deepseek-r1 (mock)', tokens: { input_tokens: 0, output_tokens: 0 } }
  }
  const client = getDeepSeek()
  const res = await client.chat.completions.create({
    model: 'deepseek-reasoner',
    messages: [{ role: 'system', content: system }, ...messages.slice(-6)],
    max_tokens: 2048,
  })
  return { respuesta: res.choices[0].message.content, razonamiento: res.choices[0].message.reasoning_content || null, modelo: 'deepseek-r1', tokens: res.usage }
}

export async function multimedia(prompt, fileData, mimeType) {
  if (AI_CONFIG.USE_MOCKS) {
    console.log(`[MOCK] gemini-2.5-flash <- "${prompt.slice(0,60)}"`)
    return { respuesta: JSON.stringify({ mock: true }), modelo: 'gemini-2.5-flash (mock)' }
  }
  const client = getGemini()
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const parts = [{ text: prompt }]
  if (fileData) parts.push({ inlineData: { mimeType: mimeType || 'application/pdf', data: fileData } })
  const res = await model.generateContent({ contents: [{ role: 'user', parts }] })
  return { respuesta: res.response.text(), modelo: 'gemini-2.5-flash' }
}

export function getProvidersStatus() {
  return {
    'claude-sonnet-4-6': { activo: AI_CONFIG.USE_MOCKS ? 'mock' : !!process.env.ANTHROPIC_API_KEY, uso: 'Logica de negocio, margenes', costo: '~$0.003/1K tokens', keyVar: 'ANTHROPIC_API_KEY' },
    'gpt-4o-mini':       { activo: AI_CONFIG.USE_MOCKS ? 'mock' : !!process.env.OPENAI_API_KEY,    uso: 'Chat WhatsApp',             costo: '~$0.00015/1K tokens', keyVar: 'OPENAI_API_KEY' },
    'deepseek-v3':       { activo: AI_CONFIG.USE_MOCKS ? 'mock' : !!process.env.DEEPSEEK_API_KEY,  uso: 'Costeo masivo',             costo: '~$0.00027/1K tokens', keyVar: 'DEEPSEEK_API_KEY' },
    'deepseek-r1':       { activo: AI_CONFIG.USE_MOCKS ? 'mock' : !!process.env.DEEPSEEK_API_KEY,  uso: 'Analisis profundo',         costo: '~$0.00055/1K tokens', keyVar: 'DEEPSEEK_API_KEY' },
    'gemini-2.5-flash':  { activo: AI_CONFIG.USE_MOCKS ? 'mock' : !!process.env.GEMINI_API_KEY,    uso: 'PDFs, imagenes, facturas',  costo: '~$0.000075/1K tokens', keyVar: 'GEMINI_API_KEY' },
  }
}

export default { AI_CONFIG, chatCliente, logicaNegocio, costeoMasivo, analisisRazon, multimedia, getProvidersStatus }