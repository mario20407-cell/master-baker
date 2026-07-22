import { useState, useCallback, useEffect } from 'react'
import {
  getDossierPasivosLaborales,
  getPerfilesLaborales,
  updatePerfilLaboral,
  getPagosVariables,
  savePagoVariable
} from '../lib/api'
import toast from 'react-hot-toast'

export function usePasivosLaborales(autoLoad = false) {
  const [dossier, setDossier] = useState(null)
  const [perfilesSinFecha, setPerfilesSinFecha] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagosVariables, setPagosVariables] = useState([])
  const [loadingPagos, setLoadingPagos] = useState(false)

  const cargarDossier = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: dossierData }, { data: perfilesData }] = await Promise.all([
        getDossierPasivosLaborales(),
        getPerfilesLaborales()
      ])
      setDossier(dossierData)
      setPerfilesSinFecha(perfilesData.filter(p => !p.fecha_ingreso))
    } catch (e) {
      toast.error('No se pudo calcular el dossier de pasivos laborales')
    } finally {
      setLoading(false)
    }
  }, [])

  const guardarPerfil = useCallback(async (usuarioId, datos) => {
    try {
      const { data } = await updatePerfilLaboral(usuarioId, datos)
      toast.success('Perfil laboral actualizado')
      await cargarDossier()
      return data
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar el perfil laboral')
      throw err
    }
  }, [cargarDossier])

  const cargarPagosVariables = useCallback(async (usuarioId) => {
    setLoadingPagos(true)
    try {
      const { data } = await getPagosVariables(usuarioId)
      setPagosVariables(data)
      return data
    } catch (e) {
      toast.error('No se pudo cargar el historial de pagos')
      throw e
    } finally {
      setLoadingPagos(false)
    }
  }, [])

  const guardarPagoVariable = useCallback(async (usuarioId, mes, monto) => {
    try {
      await savePagoVariable(usuarioId, mes, monto)
      toast.success('Pago mensual registrado')
      // Recargar pagos de este colaborador
      const { data } = await getPagosVariables(usuarioId)
      setPagosVariables(data)
      // Recargar pasivos agregados
      await cargarDossier()
      return data
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al registrar el pago')
      throw err
    }
  }, [cargarDossier])

  useEffect(() => {
    if (autoLoad) {
      cargarDossier()
    }
  }, [autoLoad, cargarDossier])

  return {
    dossier,
    perfilesSinFecha,
    loading,
    pagosVariables,
    loadingPagos,
    cargarDossier,
    guardarPerfil,
    cargarPagosVariables,
    guardarPagoVariable
  }
}
