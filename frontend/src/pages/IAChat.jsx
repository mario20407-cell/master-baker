import { useState, useRef, useEffect } from 'react'
import { useRecetas } from '../hooks/useRecetas'
import { Bot, Send, User, Upload, FileText, Zap, Brain, Image } from 'lucide-react'
import { getAiStatus, chatIA, analizarPdf } from '../lib/api'

const MODELOS = [
  { id: 'logica_negocio', label: 'Asesor de negocio',  desc: 'Márgenes y decisiones', color: '#534AB7' },
  { id: 'chat',           label: 'Atención al cliente', desc: 'Consultas rápidas',     color: '#378ADD' },
  { id: 'costeo',         label: 'Costeo masivo',       desc: 'Recetas y escalado',    color: '#1D9E75' },
  { id: 'analisis_razon', label: 'Análisis profundo',   desc: 'Estrategia y optimización', color: '#0F6E56' },
  { id: 'pdf',            label: 'Leer documentos',     desc: 'PDFs e imágenes',       color: '#D85A30' },
]

const SUGERENCIAS = {
  logica_negocio: ['¿Qué productos tienen margen menor al 57%?','Analiza la rentabilidad de los cheesecakes','¿Cuándo debo reponer harina?'],
  chat:           ['¿Cuál es el precio del Croissant?','Quiero pedir 2 Rines de chocolate','¿Tienen delivery?'],
  costeo:         ['Costea estas recetas con los datos que tengo','Escala donas de 100 a 500 piezas','Optimiza costos de galletas para 57% de margen'],
  analisis_razon: ['¿Mejor estrategia para reducir desperdicios?','¿Qué días producir más?','Compara: producir vs comprar hojaldre'],
  pdf:            ['Sube un PDF o imagen para analizar'],
}

export default function IAChat() {
  const { recetas } = useRecetas()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hola. Soy el asistente de Master Baker. Elige el tipo de consulta según tu necesidad y escríbeme.', modelo: 'sistema' }
  ])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [modeloSel, setModeloSel]   = useState('logica_negocio')
  const [archivo, setArchivo]       = useState(null)
  const [archivoB64, setArchivoB64] = useState(null)
  const [archivoMime, setArchivoMime] = useState(null)
  const [status, setStatus]         = useState(null)
  const bottomRef = useRef(null)
  const fileRef   = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    getAiStatus().then(r => setStatus(r.data)).catch(() => {})
  }, [])

  const handleArchivo = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setArchivo(file)
    setModeloSel('pdf')
    const reader = new FileReader()
    reader.onload = ev => { setArchivoB64(ev.target.result.split(',')[1]); setArchivoMime(file.type) }
    reader.readAsDataURL(file)
  }

  const enviar = async (texto) => {
    const msg = texto || input.trim()
    if ((!msg && !archivo) || loading) return
    const contenido = archivo ? `[Archivo: ${archivo.name}]\n${msg || 'Analiza este archivo'}` : msg
    const userMsg = { role: 'user', content: contenido }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const historial = [...messages, userMsg]
      .filter(m => m.role !== 'sistema')
      .slice(-10)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))

    try {
      let resultado
      let tipoUsado = modeloSel
      if (archivo && archivoB64) {
        const tipo = archivoMime?.includes('pdf') ? 'receta' : archivoMime?.includes('image') ? 'factura' : 'manual'
        tipoUsado = 'pdf'
        const { data } = await analizarPdf(archivoB64, archivoMime, tipo)
        resultado = { respuesta: typeof data.datos === 'string' ? data.datos : JSON.stringify(data.datos, null, 2), modelo: data.modelo }
        setArchivo(null); setArchivoB64(null); setArchivoMime(null)
      } else {
        const { data } = await chatIA(historial, modeloSel, { recetas: Object.keys(recetas).join(', ') || 'Ninguna' })
        resultado = data
      }
      setMessages(prev => [...prev, { role: 'assistant', content: resultado.respuesta, modelo: resultado.modelo, tipoUsado, razonamiento: resultado.razonamiento }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠ ${e.response?.data?.error || 'Error de conexión. Verifica que el backend esté corriendo.'}`, modelo: 'error' }])
    } finally { setLoading(false) }
  }

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }
  const modeloActual = MODELOS.find(m => m.id === modeloSel)
  const sugs = SUGERENCIAS[modeloSel] || []

  return (
    <div className="max-w-3xl flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>

      {/* Selector de modelo */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {MODELOS.map(m => (
          <button key={m.id} onClick={() => setModeloSel(m.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition-all"
            style={{ background: modeloSel === m.id ? m.color : 'white', color: modeloSel === m.id ? '#fff' : '#6b7280', borderColor: modeloSel === m.id ? m.color : '#e5e7eb' }}>
            <span className="font-medium">{m.label}</span>
            <span style={{ opacity: 0.8 }}>— {m.desc}</span>
          </button>
        ))}
      </div>

      {/* Estado del sistema (sin exponer nombres de proveedores de IA) */}
      {status && (
        <div className="flex gap-2 mb-3">
          {(() => {
            const algunoActivo = !status.modoMock && Object.values(status.modelos || {}).some(v => v.activo === true)
            return (
              <span className="text-[10px] flex items-center gap-1" style={{ color: algunoActivo ? '#3B6D11' : '#9ca3af' }}>
                <span>{algunoActivo ? '●' : '○'}</span> Sistema {algunoActivo ? 'activo' : 'en modo limitado'}
              </span>
            )
          })()}
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: m.role === 'assistant' ? (modeloActual?.color || '#C29C53') : '#e5e7eb' }}>
              {m.role === 'assistant' ? <Bot size={13} className="text-white" /> : <User size={13} className="text-gray-600" />}
            </div>
            <div className="max-w-[85%] space-y-1">
              {m.modelo && m.role === 'assistant' && m.modelo !== 'sistema' && (
                <div className="text-[10px] text-gray-400 px-1">{MODELOS.find(mo => mo.id === m.tipoUsado)?.label || modeloActual?.label}</div>
              )}
              {m.razonamiento && (
                <details className="text-[10px] text-gray-400 bg-gray-50 rounded-lg px-2 py-1">
                  <summary className="cursor-pointer font-medium">Ver análisis detallado</summary>
                  <pre className="whitespace-pre-wrap mt-1 text-[10px]">{m.razonamiento}</pre>
                </details>
              )}
              <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${m.role === 'user' ? 'text-white rounded-tr-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'}`}
                style={m.role === 'user' ? { background: '#C29C53' } : {}}>
                {m.content.split('\n').map((line, j) => <span key={j}>{line}{j < m.content.split('\n').length - 1 ? <br /> : null}</span>)}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: modeloActual?.color || '#C29C53' }}>
              <Bot size={13} className="text-white" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm">
              <div className="flex gap-1 items-center h-5">
                {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: modeloActual?.color || '#C29C53', animationDelay: `${i*0.15}s` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sugerencias */}
      {messages.length <= 1 && (
        <div className="flex gap-2 flex-wrap mb-2">
          {sugs.map((s, i) => <button key={i} onClick={() => enviar(s)} className="btn-secondary text-xs px-2 py-1.5 text-left leading-tight">{s}</button>)}
        </div>
      )}

      {/* Archivo seleccionado */}
      {archivo && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#FAEEDA', color: '#633806' }}>
          <FileText size={13} />
          <span className="flex-1 truncate">{archivo.name}</span>
          <button onClick={() => { setArchivo(null); setArchivoB64(null) }} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 bg-white border border-gray-200 rounded-xl p-2 shadow-sm">
        <input type="file" ref={fileRef} onChange={handleArchivo} accept=".pdf,image/*" className="hidden" />
        <button onClick={() => fileRef.current?.click()} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Subir PDF o imagen">
          <Upload size={15} />
        </button>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
          placeholder={modeloSel === 'pdf' ? 'Sube un PDF o imagen...' : 'Escribe tu pregunta... (Enter para enviar)'}
          rows={1} className="flex-1 resize-none border-none bg-transparent focus:ring-0 text-sm py-1 px-1" style={{ outline: 'none' }} />
        <button onClick={() => enviar()} disabled={(!input.trim() && !archivo) || loading}
          className="p-2 rounded-lg text-white flex-shrink-0 disabled:opacity-40 transition-all"
          style={{ background: modeloActual?.color || '#C29C53' }}>
          <Send size={14} />
        </button>
      </div>

      <div className="text-[10px] text-gray-400 text-center mt-1">
        Activo: <strong>{modeloActual?.label}</strong> — {modeloActual?.desc}
      </div>
    </div>
  )
}