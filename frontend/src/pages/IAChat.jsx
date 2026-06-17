import { useState, useRef, useEffect } from 'react'
import { useRecetas } from '../hooks/useRecetas'
import { Bot, Send, User, Upload, FileText, Zap, Brain, Image } from 'lucide-react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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
    axios.get(`${API}/api/ai/status`).then(r => setStatus(r.data)).catch(() => {})
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
        const { data } = await axios.post(`${API}/api/ai/analizar-pdf`, { fileBase64: archivoB64, mimeType: archivoMime, tipo })
        resultado = { respuesta: typeof data.datos === 'string' ? data.datos : JSON.stringify(data.datos, null, 2), modelo: data.modelo }
        setArchivo(null); setArchivoB64(null); setArchivoMime(null)
      } else {
        const { data } = await axios.post(`${API}/api/ai/chat`, {