import { useState, useEffect, useCallback } from 'react'
import { getCatalogo } from '../lib/api'

export function useCatalogo() {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const { data } = await getCatalogo()
      setProductos(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const categorias = [...new Set(productos.map(p => p.categoria))].sort()
  const getProducto = (nombre) => productos.find(p => p.nombre === nombre)
  const getPorCategoria = (cat) => cat === 'Todos' ? productos : productos.filter(p => p.categoria === cat)

  return { productos, cargando, error, recargar: cargar, categorias, getProducto, getPorCategoria }
}

export default useCatalogo
