import { useState, useEffect, useRef, useCallback } from 'react'
import { getPedidosWhatsapp } from '../lib/api'
import toast from 'react-hot-toast'

const STORAGE_KEY = 'wa_notif_ultimo_visto'
const INTERVALO_MS = 30000

function formatoCordobas(n) {
  return 'C$' + (Number(n) || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Notificaciones "dentro del panel" para pedidos nuevos que llegan por el
// bot de WhatsApp — nada de push del navegador (decisión explícita: solo
// mientras el panel está abierto). Sondea GET /whatsapp/pedidos cada 30s
// y compara contra el creado_en más reciente ya visto (persistido en
// localStorage para que un refresh no vuelva a mostrar toasts viejos).
// Sigue la misma convención que el heartbeat de Layout.jsx: nunca debe
// romper la app ni mostrar un toast de error si el sondeo falla.
export function useWhatsappNotifications(activo) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [ultimosNuevos, setUltimosNuevos] = useState([])
  const ultimoVistoRef = useRef(localStorage.getItem(STORAGE_KEY))
  const inicializadoRef = useRef(!!localStorage.getItem(STORAGE_KEY))
  const fetchingRef = useRef(false)

  const sondear = useCallback(async () => {
    if (!activo || fetchingRef.current || document.visibilityState !== 'visible') return
    fetchingRef.current = true
    try {
      const { data } = await getPedidosWhatsapp()
      const pedidos = data.pedidos || []
      if (!pedidos.length) return

      const masReciente = pedidos.reduce((max, p) => (p.creado_en > max ? p.creado_en : max), pedidos[0].creado_en)

      if (!inicializadoRef.current) {
        // Primera vez que corre en este navegador: fijamos línea de base
        // sin notificar, para no bombardear con pedidos viejos al entrar.
        inicializadoRef.current = true
        ultimoVistoRef.current = masReciente
        localStorage.setItem(STORAGE_KEY, masReciente)
        return
      }

      const nuevos = pedidos.filter(p => p.creado_en > ultimoVistoRef.current)
      if (nuevos.length) {
        nuevos.forEach(p => {
          toast(`Nuevo pedido de ${p.nombre || p.telefono} — ${formatoCordobas(p.total)}`, { icon: '🛒' })
        })
        setUnreadCount(c => c + nuevos.length)
        setUltimosNuevos(prev => [...nuevos, ...prev].slice(0, 8))
      }

      ultimoVistoRef.current = masReciente
      localStorage.setItem(STORAGE_KEY, masReciente)
    } catch (e) {
      // silencioso a propósito — es un sondeo de fondo, no debe interrumpir al usuario
    } finally {
      fetchingRef.current = false
    }
  }, [activo])

  useEffect(() => {
    if (!activo) return
    sondear()
    const intervalo = setInterval(sondear, INTERVALO_MS)
    return () => clearInterval(intervalo)
  }, [activo, sondear])

  const limpiarNoLeidos = useCallback(() => {
    setUnreadCount(0)
    setUltimosNuevos([])
  }, [])

  return { unreadCount, ultimosNuevos, limpiarNoLeidos }
}
