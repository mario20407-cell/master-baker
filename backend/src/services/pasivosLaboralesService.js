// Cálculo de pasivos laborales según el Código del Trabajo de Nicaragua
// (Ley 185) y la Ley de Seguridad Social (Ley 539). Cifras y porcentajes
// vigentes 2026. Esta herramienta es informativa — no sustituye asesoría
// legal/contable profesional.
//
// Fuentes de referencia usadas para las tasas:
// - INSS: 7% laboral (retención al trabajador) + 21.5% patronal
//   (empresas con menos de 50 trabajadores) + 2% INATEC patronal.
// - Aguinaldo (Art. 93-96 Ley 185): 1 mes de salario por año trabajado,
//   proporcional, acumulado en el período dic-nov.
// - Vacaciones (Art. 76-88 Ley 185): 15 días pagados por cada 6 meses
//   trabajados (30 días/año).
// - Indemnización por antigüedad (Art. 45 Ley 185): escala de 1 a 5 meses
//   de salario según años de servicio, aplicable solo en caso de despido
//   sin justa causa.

export const TASAS = {
  INSS_LABORAL: 0.07,
  INSS_PATRONAL: 0.215,   // empresas con menos de 50 trabajadores
  INSS_PATRONAL_GRANDE: 0.225, // empresas con 50+ trabajadores
  INATEC: 0.02,
}

const MS_POR_DIA = 1000 * 60 * 60 * 24
const DIAS_POR_MES = 30.4375 // promedio calendario, usado en toda la nómina nicaragüense

export function mesesEntre(fechaInicio, fechaFin) {
  if (!fechaInicio) return 0
  const inicio = new Date(fechaInicio)
  const fin = new Date(fechaFin)
  const diffMs = fin - inicio
  if (diffMs <= 0) return 0
  return diffMs / MS_POR_DIA / DIAS_POR_MES
}

// Determina la base salarial a usar en cada cálculo, según si el
// colaborador cobra salario fijo o pago variable (destajo/por producción,
// ej. "por quintal"). Para pago variable, la ley exige bases distintas
// según el concepto: el aguinaldo usa el mes más alto de los últimos 6
// meses, mientras que vacaciones e indemnización usan un promedio de
// ingresos reales, y el INSS patronal se calcula mes a mes sobre lo
// efectivamente pagado.
export function calcularBaseSalarial(colaborador, pagosVariables = []) {
  if (colaborador.tipo_pago === 'variable') {
    const ultimos6 = pagosVariables.slice(0, 6)
    if (ultimos6.length === 0) {
      return { aguinaldo: 0, vacaciones: 0, indemnizacion: 0, inssPatronal: 0, fuente: 'variable', sinDatos: true, mesesConDatos: 0 }
    }
    const montos = ultimos6.map(p => Number(p.monto))
    const maximo = Math.max(...montos)
    const promedio = montos.reduce((a, b) => a + b, 0) / montos.length
    return {
      aguinaldo: maximo,
      vacaciones: promedio,
      indemnizacion: promedio,
      inssPatronal: montos[0], // mes más reciente registrado
      fuente: 'variable',
      sinDatos: false,
      mesesConDatos: montos.length,
    }
  }

  const salario = Number(colaborador.salario_mensual) || 0
  return { aguinaldo: salario, vacaciones: salario, indemnizacion: salario, inssPatronal: salario, fuente: 'fijo', sinDatos: salario === 0, mesesConDatos: null }
}

// El "año de aguinaldo" corre del 1 de diciembre al 30 de noviembre
// siguiente (se paga en los primeros 10 días de diciembre por el período
// que recién terminó). Devuelve el 1 de diciembre del período vigente.
function inicioPeriodoAguinaldo(hoy) {
  const anio = hoy.getMonth() === 11 ? hoy.getFullYear() : hoy.getFullYear() - 1
  return new Date(anio, 11, 1)
}

export function calcularAguinaldoAcumulado(aguinaldoBase, fechaIngreso, hoy = new Date()) {
  const inicioIngreso = new Date(fechaIngreso)
  const inicioPeriodo = inicioPeriodoAguinaldo(hoy)
  const inicio = inicioIngreso > inicioPeriodo ? inicioIngreso : inicioPeriodo
  const meses = Math.min(mesesEntre(inicio, hoy), 12)
  const monto = (aguinaldoBase / 12) * meses
  return { meses: Number(meses.toFixed(2)), monto }
}

// Nota: este cálculo asume que el colaborador no ha gozado vacaciones
// desde su ingreso — es una provisión bruta acumulada, no un saldo neto
// real. Si ya tomó vacaciones, el pasivo real es menor a lo mostrado.
export function calcularVacacionesAcumuladas(vacacionesBase, fechaIngreso, hoy = new Date()) {
  const mesesTotal = mesesEntre(fechaIngreso, hoy)
  const dias = mesesTotal * 2.5 // 15 días cada 6 meses
  const valorDiario = vacacionesBase / 30
  const monto = dias * valorDiario
  return { dias: Number(dias.toFixed(1)), monto }
}

// Indemnización potencial por despido sin justa causa (Art. 45 Ley 185).
// Es hipotética: solo se convierte en pasivo real si ocurre un despido
// injustificado. Se muestra para que el dueño dimensione el riesgo/costo
// de una eventual salida de personal.
export function calcularIndemnizacionPotencial(indemnizacionBase, fechaIngreso, hoy = new Date()) {
  const mesesTotal = mesesEntre(fechaIngreso, hoy)
  const anios = mesesTotal / 12
  let meses
  if (anios < 1) meses = 1
  else if (anios < 2) meses = 2
  else if (anios < 3) meses = 3
  else if (anios < 4) meses = 4
  else meses = 5
  const monto = indemnizacionBase * meses
  return { anios: Number(anios.toFixed(2)), meses, monto }
}

export function calcularInssPatronalMensual(inssPatronalBase, empresaGrande = false) {
  const tasaPatronal = empresaGrande ? TASAS.INSS_PATRONAL_GRANDE : TASAS.INSS_PATRONAL
  const patronal = inssPatronalBase * tasaPatronal
  const inatec = inssPatronalBase * TASAS.INATEC
  return { patronal, inatec, total: patronal + inatec, tasaPatronal }
}

// Cálculo consolidado de un colaborador. Devuelve null si no hay fecha de
// ingreso registrada (dato mínimo indispensable para todos los cálculos).
export function calcularPasivoColaborador(colaborador, pagosVariables = [], empresaGrande = false) {
  if (!colaborador.fecha_ingreso) return null

  const hoy = new Date()
  const base = calcularBaseSalarial(colaborador, pagosVariables)
  const aguinaldo = calcularAguinaldoAcumulado(base.aguinaldo, colaborador.fecha_ingreso, hoy)
  const vacaciones = calcularVacacionesAcumuladas(base.vacaciones, colaborador.fecha_ingreso, hoy)
  const indemnizacion = calcularIndemnizacionPotencial(base.indemnizacion, colaborador.fecha_ingreso, hoy)
  const inss = calcularInssPatronalMensual(base.inssPatronal, empresaGrande)
  const mesesAntiguedad = mesesEntre(colaborador.fecha_ingreso, hoy)

  return {
    usuario_id: colaborador.id,
    nombre: colaborador.nombre,
    tipo_pago: colaborador.tipo_pago,
    base,
    mesesAntiguedad: Number(mesesAntiguedad.toFixed(1)),
    aguinaldo,
    vacaciones,
    indemnizacionPotencial: indemnizacion,
    inssPatronalMensual: inss,
    // Pasivo acumulado real (aguinaldo + vacaciones) — no incluye la
    // indemnización potencial porque esa solo aplica si hay despido.
    pasivoAcumulado: aguinaldo.monto + vacaciones.monto,
  }
}
