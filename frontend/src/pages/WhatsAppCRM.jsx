import { useState, useEffect, useCallback } from 'react'
import {
  getPedidosWhatsapp, marcarPedidoWhatsappListo, cambiarEstadoPedidoWhatsapp,
  getClientesWhatsapp, getMensajesClienteWhatsapp,
} from '../lib/api'
import {
  MessageCircle, Package, Users, Clock, CalendarClock, CheckCircle2,
  Loader2, ChevronDown, ChevronUp, MapPin, Bell,
} from 'lucide-react'
import toast from 'react-hot-toast'

const ESTADO_LABEL = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  en_preparacion: 'En preparación',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

const ESTADO_COLOR = {
  pendiente: '#C29C53',
  confirmado: '#3B6D11',
  en_preparacion: '#263D4F',
  listo: '#27500A',
  entregado: '#6B7280',
  cancelado: '#B91C1C',
}

function formatoCordobas(n) {
  return 'C$' + (Number(n) || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatoFecha(f) {
  if (!f) return '—'
  return new Date(f).toLocaleString('es-NI', {
    timeZone: 'America/Managua', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function WhatsAppCRM() {
  const [tab, setTab] = useState('pedidos')

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle size={20} className="text-[#3B6D11]" />
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">WhatsApp — CRM</h2>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-3">
        Pedidos y clientes que llegan por el bot de WhatsApp. Marcá un pedido como "listo" para avisarle al cliente automáticamente.
      </p>

      <div className="flex gap-1 border-b border-gray-200 dark:border-navy-800">
        <button
          onClick={() => setTab('pedidos')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            tab === 'pedidos' ? 'border-[#C29C53] text-[#263D4F] dark:text-gray-100' : 'border-transparent text-gray-400'
          }`}
        >
          <Package size={13} className="inline mr-1 -mt-0.5" /> Pedidos
        </button>
        <button
          onClick={() => setTab('clientes')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            tab === 'clientes' ? 'border-[#C29C53] text-[#263D4F] dark:text-gray-100' : 'border-transparent text-gray-400'
          }`}
        >
          <Users size={13} className="inline mr-1 -mt-0.5" /> Clientes
        </button>
      </div>

      {tab === 'pedidos' ? <TabPedidos /> : <TabClientes />}
    </div>
  )
}

// ── Tab: Pedidos ────────────────────────────────────────────────────────────
function TabPedidos() {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('activos')
  const [marcando, setMarcando] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await getPedidosWhatsapp()
      setPedidos(data.pedidos || [])
    } catch (e) {
      toast.error('No se pudieron cargar los pedidos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const handleMarcarListo = async (id) => {
    setMarcando(id)
    try {
      const { data } = await marcarPedidoWhatsappListo(id)
      toast.success(data.avisado ? 'Pedido listo — cliente avisado por WhatsApp 🎉' : 'Pedido marcado como listo (no se pudo enviar el WhatsApp)')
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo marcar el pedido')
    } finally {
      setMarcando(null)
    }
  }

  const handleCambiarEstado = async (id, estado) => {
    try {
      await cambiarEstadoPedidoWhatsapp(id, estado)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo cambiar el estado')
    }
  }

  const pedidosFiltrados = pedidos.filter(p => {
    if (filtro === 'activos') return !['entregado', 'cancelado'].includes(p.estado)
    if (filtro === 'agendados') return p.tipo_entrega === 'agendado' && !['entregado', 'cancelado'].includes(p.estado)
    if (filtro === 'todos') return true
    return p.estado === filtro
  })

  if (loading) return <div className="text-xs text-gray-400 py-8 text-center">Cargando pedidos…</div>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {[
          { id: 'activos', label: 'Activos' },
          { id: 'agendados', label: 'Agendados' },
          { id: 'listo', label: 'Listos' },
          { id: 'todos', label: 'Todos' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`px-3 py-1 text-[11px] rounded-full font-medium transition-colors ${
              filtro === f.id
                ? 'bg-[#263D4F] text-white'
                : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {pedidosFiltrados.length === 0 && (
        <div className="card text-center py-8 text-xs text-gray-400">No hay pedidos en esta vista.</div>
      )}

      {pedidosFiltrados.map(p => (
        <PedidoCard
          key={p.id}
          pedido={p}
          marcando={marcando === p.id}
          onMarcarListo={() => handleMarcarListo(p.id)}
          onCambiarEstado={(estado) => handleCambiarEstado(p.id, estado)}
        />
      ))}
    </div>
  )
}

function PedidoCard({ pedido, marcando, onMarcarListo, onCambiarEstado }) {
  const [abierto, setAbierto] = useState(false)
  const items = Array.isArray(pedido.items) ? pedido.items : []
  const puedeMarcarListo = !['listo', 'entregado', 'cancelado'].includes(pedido.estado)

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {pedido.nombre || pedido.telefono}
            </span>
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: ESTADO_COLOR[pedido.estado] || '#6B7280' }}
            >
              {ESTADO_LABEL[pedido.estado] || pedido.estado}
            </span>
            {pedido.tipo_entrega === 'agendado' && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white bg-[#C29C53] flex items-center gap-1">
                <CalendarClock size={10} /> Agendado
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">{pedido.telefono}</p>

          {pedido.tipo_entrega === 'agendado' && pedido.fecha_programada && (
            <p className="text-xs text-[#263D4F] dark:text-gray-200 font-medium mt-1 flex items-center gap-1">
              <Clock size={12} /> Para: {formatoFecha(pedido.fecha_programada)}
            </p>
          )}

          {pedido.direccion && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
              <MapPin size={12} /> {pedido.direccion}
            </p>
          )}

          <button
            onClick={() => setAbierto(o => !o)}
            className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center gap-1 mt-2"
          >
            {items.length} producto{items.length !== 1 ? 's' : ''} — {formatoCordobas(pedido.total)}
            {abierto ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {abierto && (
            <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-navy-800 pt-2">
              {items.map((it, i) => (
                <li key={i} className="flex justify-between">
                  <span>{it.cantidad}x {it.producto}</span>
                  <span>{formatoCordobas((it.precio_unitario || 0) * (it.cantidad || 0))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
          {puedeMarcarListo && (
            <button
              onClick={onMarcarListo}
              disabled={marcando}
              className="btn-primary text-[11px] py-1.5 px-3 flex items-center gap-1 whitespace-nowrap"
            >
              {marcando ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
              Marcar listo
            </button>
          )}
          {pedido.estado === 'listo' && (
            <button
              onClick={() => onCambiarEstado('entregado')}
              className="text-[11px] py-1.5 px-3 rounded-lg border border-gray-200 dark:border-navy-800 text-gray-600 dark:text-gray-300 flex items-center gap-1"
            >
              <CheckCircle2 size={12} /> Entregado
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tab: Clientes ───────────────────────────────────────────────────────────
function TabClientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [mensajes, setMensajes] = useState({})

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getClientesWhatsapp()
        setClientes(data.clientes || [])
      } catch (e) {
        toast.error('No se pudieron cargar los clientes')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const toggleExpandir = async (cliente) => {
    if (expandido === cliente.telefono) {
      setExpandido(null)
      return
    }
    setExpandido(cliente.telefono)
    if (!mensajes[cliente.telefono]) {
      try {
        const { data } = await getMensajesClienteWhatsapp(cliente.telefono)
        setMensajes(m => ({ ...m, [cliente.telefono]: data.mensajes || [] }))
      } catch (e) {
        toast.error('No se pudo cargar el historial')
      }
    }
  }

  if (loading) return <div className="text-xs text-gray-400 py-8 text-center">Cargando clientes…</div>
  if (clientes.length === 0) return <div className="card text-center py-8 text-xs text-gray-400">Todavía no hay clientes registrados por el bot.</div>

  return (
    <div className="space-y-2">
      {clientes.map(c => (
        <div key={c.id} className="card">
          <button onClick={() => toggleExpandir(c)} className="w-full flex items-center justify-between text-left">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{c.nombre || c.telefono}</p>
              <p className="text-[11px] text-gray-400">{c.telefono} — última vez {formatoFecha(c.ultima_interaccion)}</p>
            </div>
            <div className="text-right flex items-center gap-3">
              <div>
                <p className="text-xs font-semibold text-[#263D4F] dark:text-gray-100">{formatoCordobas(c.total_gastado)}</p>
                <p className="text-[10px] text-gray-400">{c.total_pedidos} pedido{c.total_pedidos != 1 ? 's' : ''}</p>
              </div>
              {expandido === c.telefono ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </div>
          </button>

          {expandido === c.telefono && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-navy-800 space-y-1.5 max-h-64 overflow-y-auto">
              {(mensajes[c.telefono] || []).length === 0 && (
                <p className="text-[11px] text-gray-400">Sin mensajes registrados.</p>
              )}
              {(mensajes[c.telefono] || []).map((m, i) => (
                <div key={i} className={`text-xs px-3 py-1.5 rounded-lg max-w-[85%] ${
                  m.rol === 'user'
                    ? 'bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-200'
                    : 'bg-[#EAF3DE] dark:bg-navy-900 text-[#27500A] dark:text-gray-200 ml-auto'
                }`}>
                  {m.contenido}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
