// src/lib/costeo.js
//
// Motor de cálculo puro para Marquéz Panadería & Repostería.
// Sin dependencias de React, sin efectos secundarios — solo matemática.
// v2.7: incorpora prorrateo fiscal DGI como parámetro opcional.

/** Margen mínimo objetivo del negocio, en porcentaje (0-100). */
export const MARGEN_OBJETIVO = 57

/**
 * Factor de costo máximo permitido sobre el precio de venta para cumplir
 * el margen objetivo. MARGEN_OBJETIVO = 57 → FACTOR_COSTO_MAX = 0.43
 */
export const FACTOR_COSTO_MAX = round4(1 - MARGEN_OBJETIVO / 100)

function round4(n) {
  return Math.round(n * 10000) / 10000
}

// ── Helpers básicos ──────────────────────────────────────────────────────────

export function calcMargen(pventa, costoUnitario) {
  const p = num(pventa)
  const c = num(costoUnitario)
  if (p <= 0) return 0
  return ((p - c) / p) * 100
}

export function calcPrecioMinimo(costoUnitario) {
  const c = num(costoUnitario)
  if (c <= 0) return 0
  return c / FACTOR_COSTO_MAX
}

export function margenAprobado(margenPct) {
  if (margenPct === null || margenPct === undefined) return false
  return margenPct >= MARGEN_OBJETIVO
}

export function validarMargen(pventa, costoUnitario) {
  const p = num(pventa)
  const c = num(costoUnitario)
  if (p <= 0 || c <= 0) return null
  const margen = calcMargen(p, c)
  return { margen, aprobado: margenAprobado(margen) }
}

export function calcFactorEscala(piezasBase, piezasObjetivo) {
  const base = num(piezasBase)
  const obj  = num(piezasObjetivo)
  if (base <= 0) return 1
  return obj / base
}

export function calcPiezasReales(piezasObjetivo, mermaPct = 0) {
  const obj   = num(piezasObjetivo)
  const merma = num(mermaPct)
  if (merma <= 0) return Math.round(obj)
  return Math.round(obj * (1 - merma / 100))
}

export function escalarCantidad(cantidadBase, factor) {
  return num(cantidadBase) * num(factor, 1)
}

export function sumarCostosIngredientes(ingredientes = [], factor = 1) {
  const f = num(factor, 1)
  let costoDirecto   = 0
  let costoIndirecto = 0

  for (const ing of ingredientes) {
    const subtotal = num(ing?.cantidad) * f * num(ing?.precio)
    if (ing?.tipo === 'indirecto') costoIndirecto += subtotal
    else costoDirecto += subtotal
  }

  return { costoDirecto, costoIndirecto, costoTotal: costoDirecto + costoIndirecto }
}

// ── Prorrateo fiscal DGI ─────────────────────────────────────────────────────

/**
 * Calcula el prorrateo fiscal por pieza.
 *
 * configFiscal: objeto de config_fiscal de la DB (o localStorage).
 *   { configurado, regimen, cuota_fija, produccion_mensual }
 *
 * Devuelve C$ por pieza que corresponde al impuesto mensual.
 * Si no hay config activa devuelve 0 (no altera el costeo).
 */
export function calcProrrateoFiscal(configFiscal) {
  if (!configFiscal?.configurado) return 0
  const cuota = num(configFiscal.cuota_fija)
  const prod  = num(configFiscal.produccion_mensual)
  if (cuota <= 0 || prod <= 0) return 0
  return cuota / prod
}

/**
 * Costo unitario ajustado con el prorrateo fiscal incluido.
 */
export function calcCostoFiscal(costoUnitario, configFiscal) {
  return num(costoUnitario) + calcProrrateoFiscal(configFiscal)
}

// ── Costeo completo ──────────────────────────────────────────────────────────

/**
 * Calcula el costeo completo de una receta, con y sin prorrateo fiscal.
 *
 * receta: { piezas, merma, pventa, ingredientes: [{ cantidad, precio, tipo }] }
 * piezasObjetivo: número de piezas a producir (null = usar piezas base)
 * configFiscal: objeto de configuración DGI (opcional — null desactiva el fiscal)
 *
 * Devuelve:
 *   — Campos base (sin fiscal): costoUnitario, margen, aprobado, precioMinimo, …
 *   — Campos fiscales: prorrateoFiscal, costoFiscalUnitario, margenFiscal,
 *     aprobadoFiscal, precioMinimoFiscal
 *
 * Los campos fiscales están a null cuando configFiscal no está configurado,
 * para que la UI pueda distinguir "fiscal inactivo" de "fiscal en 0".
 */
export function calcularCosteoReceta(receta, piezasObjetivo = null, configFiscal = null) {
  const piezasBase = num(receta?.piezas)
  const objetivo   = piezasObjetivo !== null ? num(piezasObjetivo) : piezasBase

  const factor      = calcFactorEscala(piezasBase, objetivo)
  const piezasReales = calcPiezasReales(objetivo, receta?.merma)

  const { costoDirecto, costoIndirecto, costoTotal } =
    sumarCostosIngredientes(receta?.ingredientes, factor)

  const costoUnitario = piezasReales > 0 ? costoTotal / piezasReales : 0
  const pventa        = num(receta?.pventa)
  const ventaTotal    = pventa * piezasReales
  const utilidad      = ventaTotal - costoTotal
  const margen        = calcMargen(pventa, costoUnitario)
  const precioMinimo  = calcPrecioMinimo(costoUnitario)

  // ── Campos fiscales ────────────────────────────────────────
  const fiscalActivo = !!configFiscal?.configurado
  const prorrateoFiscal      = fiscalActivo ? calcProrrateoFiscal(configFiscal) : null
  const costoFiscalUnitario  = fiscalActivo ? costoUnitario + prorrateoFiscal : null
  const margenFiscal         = fiscalActivo ? calcMargen(pventa, costoFiscalUnitario) : null
  const precioMinimoFiscal   = fiscalActivo ? calcPrecioMinimo(costoFiscalUnitario) : null
  const aprobadoFiscal       = fiscalActivo ? margenAprobado(margenFiscal) : null

  return {
    // Escala
    factor,
    piezasReales,

    // Costos de insumos (sin impuestos)
    costoDirecto,
    costoIndirecto,
    costoTotal,
    costoUnitario,

    // Precio y margen sin fiscal
    pventa,
    ventaTotal,
    utilidad,
    margen,
    precioMinimo,
    aprobado: margenAprobado(margen),

    // Fiscal DGI (null si no configurado)
    fiscalActivo,
    prorrateoFiscal,
    costoFiscalUnitario,
    margenFiscal,
    precioMinimoFiscal,
    aprobadoFiscal,
  }
}

// ── Helper interno ────────────────────────────────────────────────────────────
function num(v, defaultVal = 0) {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return typeof n === 'number' && !Number.isNaN(n) ? n : defaultVal
}
