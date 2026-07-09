// backend/src/utils/normalizarInsumo.js
import { convertirCantidad } from './unidades.js'

export function normalizarInsumo({ nombre, existencia, unidad, consumo_diario, punto_reposicion, costo_unitario }) {
  const uOld = (unidad || '').toLowerCase().trim()
  let uBase = 'unidad'
  let factor = 1

  if (['kg', 'g', 'lb', 'libra', 'libras', 'lbs', 'oz', 'onza', 'onzas'].includes(uOld)) {
    uBase = 'g'
    factor = convertirCantidad(1, uOld, 'g')
  } else if (['l', 'ml', 'litro', 'litros', 'mililitro', 'mililitros'].includes(uOld)) {
    uBase = 'ml'
    factor = convertirCantidad(1, uOld, 'ml')
  } else if (uOld) {
    uBase = 'unidad'
  }

  const ex = parseFloat(existencia) || 0
  const cd = parseFloat(consumo_diario) || 0
  const pr = parseFloat(punto_reposicion) || 0
  const cu = parseFloat(costo_unitario) || 0

  return {
    nombre: (nombre || '').trim(),
    existencia: ex * factor,
    unidad: uBase,
    consumo_diario: cd * factor,
    punto_reposicion: pr * factor,
    costo_unitario: cu / factor
  }
}
