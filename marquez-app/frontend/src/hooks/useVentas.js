/**
 * useVentas — hook que gestiona el estado de ventas.
 * v2.7.1 — Fix: ventas pendientes se sincronizan al reconectarse.
 *
 * Estrategia dual:
 *   1. Carga ventas del día desde localStorage (cero latencia).
 *   2. Sincroniza con /api/ventas en background.
 *   3. Al registrar: primero API, fallback a localStorage con flag _pendiente.
 *   4. Al reconectarse: reintenta las ventas pendientes antes de sobreescribir.
 */
import { useState, useEffect, useCallback } from 'react'
import { getVentas, getVentaResumen, saveVenta, deleteVenta } from '../lib/api'
import toast from 'react-hot-toast'

const HOY_ISO = () => new Date().toISOString().slice(0, 10)

const STORAGE_KEY = 'marquez_ventas_v2'

function leerLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw).filter(v => v.fecha === HOY_ISO())
  } catch { return [] }
}

function escribirLocal(ventas) {
  try {
    const raw    = localStorage.getItem(STORAGE_KEY)
    const todas  = raw ? JSON.parse(raw) : []
    const sinHoy = todas.filter(v => v.fecha !== HOY_ISO())
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...sinHoy, ...ventas]))
  } catch {}
}

function calcResumenLocal(ventas) {
  const ingresos      = ventas.reduce((s, v) => s + parseFloat(v.total || 0), 0)
  const efectivo      = ventas.filter(v => (v.metodo_pago || v.metodo) === 'efectivo').reduce((s, v) => s + parseFloat(v.total), 0)
  const tarjeta       = ventas.filter(v => (v.metodo_pago || v.metodo) === 'tarjeta').reduce((s, v) => s + parseFloat(v.total), 0)
  const transferencia = ventas.filter(v => (v.metodo_pago || v.metodo) === 'transferencia').reduce((s, v) => s + parseFloat(v.total), 0)

  const prodCount = {}
  ventas.forEach(v => (v.items || []).forEach(i => {
    const nombre = i.producto || i.n || '—'
    prodCount[nombre] = (prodCount[nombre] || 0) + (i.cantidad ?? i.qty ?? 1)
  }))
  const top_productos = Object.entries(prodCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([producto, piezas]) => ({ producto, piezas }))

  return { total_ventas: ventas.length, ingresos, ticket_promedio: ventas.length > 0 ? ingresos / ventas.length : 0, efectivo, tarjeta, transferencia, top_productos }
}

// Reintentar ventas pendientes que quedaron en localStorage
async function sincronizarPendientes(pendientes) {
  if (!pendientes.length) return []
  const sincronizadas = []
  for (const v of pendientes) {
    try {
      const payload = {
        items:       v.items,
        total:       parseFloat(v.total),
        metodo_pago: v.metodo_pago || v.metodo || 'efectivo',
        canal:       v.canal || 'tienda',
        cliente:     v.cliente || 'Sin nombre',
        fecha:       v.fecha,
      }
      const { data } = await saveVenta(payload)
      sincronizadas.push(data)
    } catch {
      // Si falla de nuevo, la dejamos pendiente
      sincronizadas.push(v)
    }
  }
  return sincronizadas
}

export function useVentas() {
  const [ventas,    setVentas]    = useState(leerLocal)
  const [resumen,   setResumen]   = useState(() => calcResumenLocal(leerLocal()))
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [apiOnline, setApiOnline] = useState(true)

  const cargarDesdeAPI = useCallback(async () => {
    try {
      // Fix: sincronizar pendientes antes de cargar desde la API
      const pendientes = leerLocal().filter(v => v._pendiente)
      if (pendientes.length) {
        toast(`Sincronizando ${pendientes.length} venta(s) pendiente(s)…`, { icon: '🔄' })
        await sincronizarPendientes(pendientes)
      }

      const [{ data: ventasData }, { data: resumenData }] = await Promise.all([
        getVentas({ fecha: HOY_ISO() }),
        getVentaResumen(HOY_ISO()),
      ])
      setVentas(ventasData)
      setResumen(resumenData)
      escribirLocal(ventasData)
      setApiOnline(true)
      setError(null)
    } catch {
      setApiOnline(false)
      setError('offline')
    }
  }, [])

  useEffect(() => { cargarDesdeAPI() }, [cargarDesdeAPI])

  useEffect(() => {
    if (!apiOnline) setResumen(calcResumenLocal(ventas))
  }, [ventas, apiOnline])

  const registrar = useCallback(async (venta) => {
    const payload = {
      items:       venta.items.map(i => ({
        producto:    i.producto || i.n,
        cantidad:    i.cantidad || i.qty || 1,
        precio_unit: parseFloat(i.precio_unit || i.p),
      })),
      total:       parseFloat(venta.total),
      metodo_pago: venta.metodo_pago || venta.metodo || 'efectivo',
      canal:       venta.canal || 'tienda',
      cliente:     venta.cliente || 'Sin nombre',
    }

    setLoading(true)
    try {
      const { data: nuevaVenta } = await saveVenta(payload)
      setVentas(prev => {
        const actualizado = [...prev, nuevaVenta]
        escribirLocal(actualizado)
        return actualizado
      })
      getVentaResumen(HOY_ISO()).then(({ data }) => setResumen(data)).catch(() => {})
      return nuevaVenta
    } catch {
      // Fallback offline con flag _pendiente
      const ventaLocal = {
        ...payload,
        id:         `local_${Date.now()}`,
        fecha:      HOY_ISO(),
        hora:       new Date().toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' }),
        _pendiente: true,
      }
      setVentas(prev => {
        const actualizado = [...prev, ventaLocal]
        escribirLocal(actualizado)
        return actualizado
      })
      toast('Venta guardada localmente — se enviará al reconectarse.', { icon: '⚠️' })
      return ventaLocal
    } finally {
      setLoading(false)
    }
  }, [])

  const anular = useCallback(async (id) => {
    if (String(id).startsWith('local_')) {
      setVentas(prev => {
        const actualizado = prev.filter(v => v.id !== id)
        escribirLocal(actualizado)
        return actualizado
      })
      return
    }
    try {
      await deleteVenta(id)
      setVentas(prev => {
        const actualizado = prev.filter(v => v.id !== id)
        escribirLocal(actualizado)
        return actualizado
      })
      getVentaResumen(HOY_ISO()).then(({ data }) => setResumen(data)).catch(() => {})
    } catch {
      toast.error('No se pudo anular la venta')
    }
  }, [])

  return { ventas, resumen, registrar, anular, recargar: cargarDesdeAPI, loading, error, apiOnline }
}
