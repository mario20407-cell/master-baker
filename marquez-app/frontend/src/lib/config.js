// ── Configuración global del negocio — Marquéz Panadería & Repostería ─────────
// Edita este archivo para ajustar parámetros del sistema sin tocar el resto del código.

export const CONFIG = {
  // Margen mínimo objetivo (%)
  MARGEN_OBJETIVO: 57,

  // Moneda
  MONEDA: 'C$',
  LOCALE: 'es-NI',

  // Merma por defecto (%)
  MERMA_DEFAULT: 15,

  // Umbral de alerta de alza en compras (%)
  UMBRAL_ALZA_COMPRAS: 10,

  // Días críticos de inventario
  DIAS_CRITICO: 3,
  DIAS_BAJO: 7,

  // Nombre del negocio
  NOMBRE_NEGOCIO: 'Master Baker',
  VERSION: '2.7',
}

// Helpers derivados del margen objetivo
export const calcPrecioMinimo = (costoUnitario) =>
  costoUnitario > 0 ? costoUnitario / (1 - CONFIG.MARGEN_OBJETIVO / 100) : 0

export const calcMargen = (pventa, costoUnitario) =>
  pventa > 0 ? ((pventa - costoUnitario) / pventa) * 100 : 0

export const margenAprobado = (margen) => margen >= CONFIG.MARGEN_OBJETIVO

export const fmt = (v) => `${CONFIG.MONEDA} ${(parseFloat(v) || 0).toFixed(2)}`
