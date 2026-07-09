// backend/src/utils/unidades.js
// Biblioteca centralizada y unificada de conversión de unidades físicas (Backend)

export const esLibra = (u) => {
  const norm = (u || '').toLowerCase().trim()
  return norm === 'lb' || norm === 'libra' || norm === 'libras' || norm === 'lbs'
}

export const esGramo = (u) => {
  const norm = (u || '').toLowerCase().trim()
  return norm === 'g' || norm === 'gramo' || norm === 'gramos'
}

export const esKilo = (u) => {
  const norm = (u || '').toLowerCase().trim()
  return norm === 'kg' || norm === 'kilo' || norm === 'kilogramo' || norm === 'kilogramos'
}

export const esOnza = (u) => {
  const norm = (u || '').toLowerCase().trim()
  return norm === 'oz' || norm === 'onza' || norm === 'onzas'
}

export const esLitro = (u) => {
  const norm = (u || '').toLowerCase().trim()
  return norm === 'l' || norm === 'litro' || norm === 'litros' || norm === 'lt' || norm === 'lts'
}

export const esMili = (u) => {
  const norm = (u || '').toLowerCase().trim()
  return norm === 'ml' || norm === 'mililitro' || norm === 'mililitros'
}

export function convertirCantidad(cantidad, uOrigen, uDestino) {
  const q = parseFloat(cantidad)
  if (Number.isNaN(q)) return 0
  if (!uOrigen || !uDestino || uOrigen === uDestino) return q

  const u1 = uOrigen.toLowerCase().trim()
  const u2 = uDestino.toLowerCase().trim()
  if (u1 === u2) return q

  // Conversiones de masa: Normalizar todo a gramos (g)
  const esArroba = (u) => u === 'arroba' || u === 'arrobas'
  let gramos = null
  if (esGramo(u1)) gramos = q
  else if (esKilo(u1)) gramos = q * 1000
  else if (esLibra(u1)) gramos = q * 454
  else if (esOnza(u1)) gramos = q * 28.3495
  else if (esArroba(u1)) gramos = q * 11500

  if (gramos !== null) {
    if (esGramo(u2)) return gramos
    if (esKilo(u2)) return gramos / 1000
    if (esLibra(u2)) return gramos / 454
    if (esOnza(u2)) return gramos / 28.3495
    if (esArroba(u2)) return gramos / 11500
    return q
  }

  // Conversiones de volumen: Normalizar todo a mililitros (ml)
  let mililitros = null
  if (esMili(u1)) mililitros = q
  else if (esLitro(u1)) mililitros = q * 1000

  if (mililitros !== null) {
    if (esMili(u2)) return mililitros
    if (esLitro(u2)) return mililitros / 1000
    return q
  }

  return q
}

export function convertirPrecio(precioBase, unidadBase, unidadDestino) {
  const p = parseFloat(precioBase)
  if (Number.isNaN(p)) return 0
  if (!unidadBase || !unidadDestino || unidadBase === unidadDestino) return p

  const u1 = unidadBase.toLowerCase().trim()
  const u2 = unidadDestino.toLowerCase().trim()
  if (u1 === u2) return p

  const factor = convertirCantidad(1, u1, u2)
  if (factor > 0) {
    return p / factor
  }

  return p
}
