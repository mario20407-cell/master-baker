/**
 * useConfiguracionCosteo — carga una sola vez la configuración de costeo
 * (costos indirectos de gas/luz/mano de obra + margen objetivo) y expone
 * `costoIndirectoGlobal` listo para pasarle a calcularCosteoReceta().
 */
import { useState, useEffect } from 'react'
import { getConfiguracionCosteoSettings } from '../lib/api'

const DEFAULT_CONFIG = {
  costo_indirecto_gas: 0,
  costo_indirecto_luz: 0,
  costo_indirecto_mano: 0,
  margen_objetivo: 57,
}

export function useConfiguracionCosteo() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)

  useEffect(() => {
    let cancelled = false
    getConfiguracionCosteoSettings()
      .then(({ data }) => {
        if (!cancelled && data) setConfig(data)
      })
      .catch(err => { console.error('Error al cargar configuración de costeo:', err) })
    return () => { cancelled = true }
  }, [])

  const costoIndirectoGlobal =
    parseFloat(config.costo_indirecto_gas || 0) +
    parseFloat(config.costo_indirecto_luz || 0) +
    parseFloat(config.costo_indirecto_mano || 0)

  return { config, costoIndirectoGlobal, margenObjetivo: parseFloat(config.margen_objetivo || 57) }
}
