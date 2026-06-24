import { useState, useEffect, useCallback } from 'react'
import { getRecetas, saveReceta, updateReceta, deleteReceta } from '../lib/api'
import { calcularCosteoReceta } from '../lib/costeo'
import toast from 'react-hot-toast'

export function useRecetas() {
  const [recetas, setRecetas] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await getRecetas()
      // Indexar por nombre de producto para acceso O(1)
      const mapa = {}
      data.forEach(r => { mapa[r.producto] = r })
      setRecetas(mapa)
    } catch (e) {
      setError(e.message)
      // Fallback: localStorage si no hay backend
      const local = localStorage.getItem('marquez_recetas')
      if (local) setRecetas(JSON.parse(local))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async (datos) => {
    try {
      const existente = recetas[datos.producto]
      let res
      if (existente?.id) {
        res = await updateReceta(existente.id, datos)
      } else {
        res = await saveReceta(datos)
      }
      const nueva = res.data
      setRecetas(prev => ({ ...prev, [nueva.producto]: nueva }))
      localStorage.setItem('marquez_recetas', JSON.stringify({ ...recetas, [nueva.producto]: nueva }))
      toast.success(`Receta de "${datos.producto}" guardada`)
      return nueva
    } catch (e) {
      // Guardar en localStorage como fallback
      const local = { ...recetas, [datos.producto]: { ...datos, id: Date.now() } }
      setRecetas(local)
      localStorage.setItem('marquez_recetas', JSON.stringify(local))
      toast.success(`Receta guardada localmente`)
      return datos
    }
  }

  const eliminar = async (productoNombre) => {
    const receta = recetas[productoNombre]
    if (!receta) return
    try {
      if (receta.id) await deleteReceta(receta.id)
      const nueva = { ...recetas }
      delete nueva[productoNombre]
      setRecetas(nueva)
      localStorage.setItem('marquez_recetas', JSON.stringify(nueva))
      toast.success('Receta eliminada')
    } catch (e) {
      toast.error('Error al eliminar receta')
    }
  }

  const calcularCostos = (productoNombre, piezasObjetivo = null) => {
    const r = recetas[productoNombre]
    if (!r) return null

    // Toda la matemática vive en lib/costeo.js (con sus unit tests).
    // Re-mapeamos a los nombres cortos que ya usa Costeo.jsx para no
    // romper la UI existente: cd/ci/ct/cu/pmin/vtotal.
    const c = calcularCosteoReceta(r, piezasObjetivo)
    return {
      cd: c.costoDirecto,
      ci: c.costoIndirecto,
      ct: c.costoTotal,
      cu: c.costoUnitario,
      pventa: c.pventa,
      vtotal: c.ventaTotal,
      utilidad: c.utilidad,
      margen: c.margen,
      pmin: c.precioMinimo,
      piezasReales: c.piezasReales,
      factor: c.factor,
    }
  }

  return { recetas, loading, error, guardar, eliminar, calcularCostos, recargar: cargar }
}
