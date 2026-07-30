import { useState, useCallback } from 'react'
import {
  getVistaPreviaPlanilla,
  generarPlanilla as generarPlanillaApi,
  getHistorialPlanillas,
  getPlanilla,
} from '../lib/api'
import toast from 'react-hot-toast'

export function usePlanilla() {
  const [vistaPrevia, setVistaPrevia] = useState(null)
  const [loadingVistaPrevia, setLoadingVistaPrevia] = useState(false)

  const [planillaActual, setPlanillaActual] = useState(null)
  const [generando, setGenerando] = useState(false)

  const [historial, setHistorial] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  const cargarVistaPrevia = useCallback(async (frecuencia, periodoInicio) => {
    setLoadingVistaPrevia(true)
    setVistaPrevia(null)
    setPlanillaActual(null) // una vista previa nueva reemplaza cualquier planilla guardada que se estuviera mostrando
    try {
      const { data } = await getVistaPreviaPlanilla(frecuencia, periodoInicio)
      setVistaPrevia(data)
      return data
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo calcular la vista previa de la planilla')
      throw e
    } finally {
      setLoadingVistaPrevia(false)
    }
  }, [])

  const cargarHistorial = useCallback(async () => {
    setLoadingHistorial(true)
    try {
      const { data } = await getHistorialPlanillas()
      setHistorial(data)
      return data
    } catch (e) {
      toast.error('No se pudo cargar el historial de planillas')
    } finally {
      setLoadingHistorial(false)
    }
  }, [])

  const generar = useCallback(async (frecuencia, periodoInicio) => {
    setGenerando(true)
    try {
      const { data } = await generarPlanillaApi(frecuencia, periodoInicio)
      setPlanillaActual(data)
      setVistaPrevia(null)
      toast.success('Planilla generada y guardada')
      await cargarHistorial()
      return data
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo generar la planilla')
      throw e
    } finally {
      setGenerando(false)
    }
  }, [cargarHistorial])

  const cargarPlanilla = useCallback(async (id) => {
    try {
      const { data } = await getPlanilla(id)
      setVistaPrevia(null)
      setPlanillaActual(data)
      return data
    } catch (e) {
      toast.error('No se pudo cargar la planilla')
      throw e
    }
  }, [])

  return {
    vistaPrevia, loadingVistaPrevia, cargarVistaPrevia,
    planillaActual, generando, generar, setPlanillaActual,
    historial, loadingHistorial, cargarHistorial, cargarPlanilla,
  }
}
