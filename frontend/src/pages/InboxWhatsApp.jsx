import { useState, useEffect, useRef } from 'react'
import api from '../lib/api'
import { MessageSquare, Search, Send, Trash2, ShieldAlert, Check, CheckCheck, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function InboxWhatsApp() {
  const [conversaciones, setConversaciones] = useState([])
  const [conversacionActiva, setConversacionActiva] = useState(null)
  const [historial, setHistorial] = useState([])
  const [loadingChats, setLoadingChats] = useState(false)
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [mensajeManual, setMensajeManual] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [botStatus, setBotStatus] = useState(null)

  const chatEndRef = useRef(null)

  // Cargar lista de chats
  const cargarConversaciones = async (silent = false) => {
    if (!silent) setLoadingChats(true)
    try {
      const { data } = await api.get('/whatsapp/conversaciones')
      setConversaciones(data)
    } catch (e) {
      console.error('Error cargando conversaciones:', e)
    } finally {
      if (!silent) setLoadingChats(false)
    }
  }

  // Cargar historial de un chat
  const cargarHistorial = async (telefono, silent = false) => {
    if (!silent) setLoadingHistorial(true)
    try {
      const { data } = await api.get(`/whatsapp/conversacion/${telefono}`)
      setHistorial(data.historial || [])
    } catch (e) {
      console.error('Error cargando historial:', e)
    } finally {
      if (!silent) setLoadingHistorial(false)
    }
  }

  // Cargar status del bot
  const cargarStatus = async () => {
    try {
      const { data } = await api.get('/whatsapp/status')
      setBotStatus(data)
    } catch (e) {}
  }

  // Inicialización y Polling (5 segundos)
  useEffect(() => {
    cargarConversaciones()
    cargarStatus()

    const interval = setInterval(() => {
      cargarConversaciones(true)
      if (conversacionActiva) {
        cargarHistorial(conversacionActiva, true)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [conversacionActiva])

  // Scroll al final al cargar mensajes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [historial])

  const seleccionarChat = (telefono) => {
    setConversacionActiva(telefono)
    cargarHistorial(telefono)
  }

  // Enviar mensaje manual
  const handleEnviar = async (e) => {
    e.preventDefault()
    const msg = mensajeManual.trim()
    if (!msg || !conversacionActiva || enviando) return

    setEnviando(true)
    try {
      await api.post('/whatsapp/enviar', {
        telefono: conversacionActiva,
        mensaje: msg
      })
      setMensajeManual('')
      await cargarHistorial(conversacionActiva)
      await cargarConversaciones(true)
      toast.success('Mensaje enviado')
    } catch (e) {
      toast.error('Error al enviar mensaje')
    } finally {
      setEnviando(false)
    }
  }

  // Borrar historial (confirmado)
  const handleBorrar = async () => {
    if (!conversacionActiva) return
    try {
      await api.delete(`/whatsapp/conversacion/${conversacionActiva}`)
      setHistorial([])
      setConversacionActiva(null)
      setShowConfirm(false)
      await cargarConversaciones()
      toast.success('Conversación eliminada')
    } catch (e) {
      toast.error('Error al eliminar conversación')
    }
  }

  const chatsFiltrados = conversaciones.filter(c => 
    c.telefono.toLowerCase().includes(filtro.toLowerCase()) || 
    (c.ultimo_mensaje && c.ultimo_mensaje.toLowerCase().includes(filtro.toLowerCase()))
  )

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] max-h-[900px] border border-gray-100 dark:border-gray-800 rounded-3xl bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
      {/* Barra de cabecera */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Inbox de WhatsApp</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">Monitoreo de chat con Inteligencia Artificial</p>
          </div>
        </div>

        {/* Estatus del Bot */}
        {botStatus && (
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${botStatus.activo ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              <span className="text-gray-500 dark:text-gray-400">
                Bot: {botStatus.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-gray-400 dark:text-gray-500">
              <span>Modelo: {botStatus.modelo}</span>
            </div>
          </div>
        )}
      </div>

      {/* Cuerpo principal */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Panel Izquierdo: Lista de Chats */}
        <div className="w-full sm:w-[320px] md:w-[360px] flex flex-col border-r border-gray-100 dark:border-gray-800 min-h-0">
          <div className="p-4 border-b border-gray-50 dark:border-gray-850">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por teléfono o mensaje..."
                value={filtro}
                onChange={e => setFiltro(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-800 dark:bg-gray-950 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-gray-50 dark:divide-gray-850">
            {loadingChats ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
              </div>
            ) : chatsFiltrados.length === 0 ? (
              <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                No hay conversaciones activas.
              </div>
            ) : (
              chatsFiltrados.map(chat => {
                const activo = conversacionActiva === chat.telefono
                return (
                  <button
                    key={chat.telefono}
                    onClick={() => seleccionarChat(chat.telefono)}
                    className={`w-full text-left p-4 transition-all flex flex-col gap-1.5 ${
                      activo 
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-l-4 border-emerald-500' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-950/50 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
                        {chat.telefono}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-550">
                        {chat.actualizado_en ? new Date(chat.actualizado_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate w-full">
                      {chat.rol_ultimo === 'assistant' ? 'IA: ' : 'Cliente: '}
                      {chat.ultimo_mensaje}
                    </p>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Panel Derecho: Historial de Chat */}
        <div className="hidden sm:flex flex-1 flex-col min-h-0 bg-gray-50/40 dark:bg-gray-950/20">
          {conversacionActiva ? (
            <>
              {/* Cabecera del chat */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center font-bold text-sm text-emerald-600 dark:text-emerald-400">
                    {conversacionActiva.slice(-2)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100">{conversacionActiva}</h3>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">Conversación activa</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowConfirm(true)}
                  className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                  title="Borrar historial"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Contenedor de burbujas */}
              <div className="flex-1 overflow-y-auto p-6 min-h-0 space-y-4">
                {loadingHistorial ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                  </div>
                ) : (
                  historial.map((msg, index) => {
                    const isUser = msg.role === 'user'
                    return (
                      <div
                        key={index}
                        className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                            isUser
                              ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-100 dark:border-gray-700/50'
                              : 'bg-emerald-500 text-white rounded-tr-none'
                          }`}
                        >
                          <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                          <div
                            className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${
                              isUser ? 'text-gray-400' : 'text-emerald-100'
                            }`}
                          >
                            <span>
                              {msg.creado_en ? new Date(msg.creado_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                            {!isUser && <CheckCheck className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input de respuesta */}
              <form
                onSubmit={handleEnviar}
                className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex gap-3 items-center"
              >
                <input
                  type="text"
                  placeholder="Escribe una respuesta manual para enviar al cliente..."
                  value={mensajeManual}
                  onChange={e => setMensajeManual(e.target.value)}
                  disabled={enviando}
                  className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-250 dark:border-gray-800 text-gray-850 dark:text-gray-150 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!mensajeManual.trim() || enviando}
                  className="p-3 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl disabled:opacity-50 transition-all flex items-center justify-center"
                >
                  {enviando ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <MessageSquare className="w-12 h-12 mb-3 stroke-[1.5]" />
              <p className="text-sm">Selecciona una conversación del listado lateral</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmación para borrar historial */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-gray-100 dark:border-gray-850 flex flex-col gap-4">
            <div className="flex gap-3 items-start">
              <div className="p-2.5 rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mt-1">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">¿Limpiar conversación?</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Esta acción eliminará de forma definitiva todo el historial de chats y mensajes con el número de teléfono <strong className="text-gray-700 dark:text-gray-300">{conversacionActiva}</strong>. No es reversible.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-950 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleBorrar}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-red-500 text-white hover:bg-red-650 transition-all"
              >
                Sí, limpiar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
