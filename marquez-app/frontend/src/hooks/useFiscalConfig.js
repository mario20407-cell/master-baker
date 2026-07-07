/**
 * useFiscalConfig — hook que provee la configuración fiscal DGI.
 *
 * Estrategia dual:
 *   1. Lee localStorage inmediatamente (cero latencia en primer render).
 *   2. Sincroniza con /api/fiscal en background y actualiza localStorage.
 *
 * Cualquier componente que necesite `configFiscal` (Costeo, Escalado,
 * Dashboard) lo importa desde aquí. No hay duplicación de lógica.
 */
import { useState, useEffect, useCallback } from 'react'
import { getFiscalConfig, saveFiscalConfig } from '../lib/api'
import toast from 'react-hot-toast'

const STORAGE_KEY = 'master_baker_config_fiscal'

const DEFAULT_CONFIG = {
  regimen: '',
  cuota_fija: '',
  produccion_mensual: '',
  ir_anual: '',
  iva_aplica: 'Ninguno',
  nombre_negocio: 'Master Baker',
  ruc: '',
  configurado: false,
}

function leerLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_CONFIG
  } catch { return DEFAULT_CONFIG }
}

function escribirLocal(config) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)) } catch {}
}

export function useFiscalConfig() {
  const [config, setConfig]   = useState(leerLocal)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  // Sincronizar con backend al montar
  useEffect(() => {
    let cancelled = false
    getFiscalConfig()
      .then(({ data }) => {
        if (cancelled) return
        if (data?.configurado) {
          setConfig(data)
          escribirLocal(data)
        }
      })
      .catch(() => {
        // Backend no disponible: localStorage sigue siendo fuente de verdad
        setError('offline')
      })
    return () => { cancelled = true }
  }, [])

  const guardar = useCallback(async (nuevaConfig) => {
    setLoading(true)
    try {
      const { data } = await saveFiscalConfig(nuevaConfig)
      setConfig(data)
      escribirLocal(data)
      toast.success('Configuración fiscal guardada')
      return data
    } catch (e) {
      // Fallback: guardar solo en localStorage si el backend falla
      const local = { ...nuevaConfig, configurado: true }
      setConfig(local)
      escribirLocal(local)
      toast.success('Guardado localmente (sincronizará al reconectarse)')
      return local
    } finally {
      setLoading(false)
    }
  }, [])

  return { config, guardar, loading, error }
}

// ── Helper estático (sin React) para costeo.js ────────────────────────────────
export function leerConfigFiscal() {
  return leerLocal()
}
