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

// Carga colaboradores activos + su historial de pagos variables en el
// mínimo de queries posible (2, sin importar cuántos colaboradores haya).
// Antes, recetas.js (sugerencia-mano-obra) y pasivosLaborales.js (dossier)
// repetían este mismo fetch cada uno por su lado, y cada uno hacía una
// query de pagos_variables POR colaborador de pago variable dentro de un
// loop (patrón N+1: con 10 colaboradores variables son 10 queries extra,
// con 50 son 50). Acá se trae todo de una sola vez y se agrupa en JS.
export async function obtenerColaboradoresConDatosLaborales(query, tenantId) {
  const { rows: colaboradores } = await query(
    `SELECT id, nombre, email, rol, tipo_pago, salario_mensual, fecha_ingreso
     FROM usuarios
     WHERE tenant_id = $1 AND activo = true
     ORDER BY nombre`,
    [tenantId]
  )

  // Empresas de 50+ trabajadores pagan una tasa de INSS patronal distinta
  // (Art. de Ley 539) — ya teníamos todas las filas activas en la query de
  // arriba, así que contar sobre eso evita un segundo round-trip solo para
  // un COUNT(*) que ya podemos calcular en memoria.
  const empresaGrande = colaboradores.length >= 50

  const idsVariables = colaboradores.filter(c => c.tipo_pago === 'variable').map(c => c.id)

  let pagosPorUsuario = {}
  if (idsVariables.length > 0) {
    const { rows: pagos } = await query(
      `SELECT usuario_id, mes, monto FROM pagos_variables
       WHERE usuario_id = ANY($1) AND tenant_id = $2
       ORDER BY usuario_id, mes DESC`,
      [idsVariables, tenantId]
    )
    for (const p of pagos) {
      if (!pagosPorUsuario[p.usuario_id]) pagosPorUsuario[p.usuario_id] = []
      pagosPorUsuario[p.usuario_id].push({ mes: p.mes, monto: p.monto })
    }
  }

  const colaboradoresConPagos = colaboradores.map(c => ({
    ...c,
    // Los cálculos de aguinaldo/vacaciones/INSS solo miran los últimos 6
    // meses (ver calcularBaseSalarial) — se recorta acá, ya ordenado DESC.
    pagosVariables: c.tipo_pago === 'variable' ? (pagosPorUsuario[c.id] || []).slice(0, 6) : [],
  }))

  return { colaboradores: colaboradoresConPagos, empresaGrande }
}

// Sugerencia de costo de mano de obra por pieza, a partir de nómina real +
// producción mensual configurada. La usan tanto la ruta GET de sugerencia
// (recetas.js, para mostrarla en Configuración) como sincronizarCostoIndirectoMano
// más abajo (para aplicarla sola cada vez que cambia un dato de nómina).
export async function calcularSugerenciaManoObra(query, tenantId) {
  const { rows: fiscalRows } = await query(
    'SELECT produccion_mensual, configurado FROM config_fiscal WHERE tenant_id = $1',
    [tenantId]
  )
  // produccion_mensual tiene default 1 en la tabla — sin este chequeo de
  // "configurado", un tenant que nunca terminó de configurar la sección
  // fiscal igual pasaría la validación y el costo laboral total se
  // dividiría entre 1 pieza, dando una sugerencia disparatada.
  if (!fiscalRows.length || !fiscalRows[0].configurado) {
    return { sugerido: null, motivo: 'fiscal_no_configurado' }
  }
  if (!fiscalRows[0].produccion_mensual || parseInt(fiscalRows[0].produccion_mensual) <= 0) {
    return { sugerido: null, motivo: 'sin_produccion_mensual' }
  }
  const produccion_mensual = parseInt(fiscalRows[0].produccion_mensual)

  const { colaboradores, empresaGrande } = await obtenerColaboradoresConDatosLaborales(query, tenantId)
  const colaboradoresValidos = colaboradores.filter(c => c.tipo_pago === 'fijo' || c.tipo_pago === 'variable')
  if (colaboradoresValidos.length === 0) {
    return { sugerido: null, motivo: 'sin_datos_nomina' }
  }

  const hoy = new Date()
  let sumaCostoLaboralTotal = 0
  let colaboradoresConSueldo = 0

  for (const c of colaboradoresValidos) {
    const base = calcularBaseSalarial(c, c.pagosVariables)
    if (base.sinDatos) continue

    const inss = calcularInssPatronalMensual(base.inssPatronal, empresaGrande)
    let costoLaboralMensual = base.inssPatronal + inss.total

    if (c.fecha_ingreso) {
      const mesesAntiguedad = mesesEntre(c.fecha_ingreso, hoy)
      if (mesesAntiguedad > 0) {
        const aguinaldo = calcularAguinaldoAcumulado(base.aguinaldo, c.fecha_ingreso, hoy)
        const vacaciones = calcularVacacionesAcumuladas(base.vacaciones, c.fecha_ingreso, hoy)
        if (aguinaldo.meses > 0) costoLaboralMensual += aguinaldo.monto / aguinaldo.meses
        costoLaboralMensual += vacaciones.monto / mesesAntiguedad
      }
    }

    sumaCostoLaboralTotal += costoLaboralMensual
    colaboradoresConSueldo++
  }

  if (colaboradoresConSueldo === 0) {
    return { sugerido: null, motivo: 'sin_datos_nomina' }
  }

  const sugerido = Math.round((sumaCostoLaboralTotal / produccion_mensual) * 100) / 100
  return { sugerido, motivo: null }
}

// Aplica la sugerencia de mano de obra directamente a configuracion_costeo,
// sin depender de que alguien apriete "usar sugerencia" a mano en la UI.
// Se llama después de cualquier escritura que pueda cambiar el resultado de
// calcularSugerenciaManoObra: perfil laboral (salario/tipo de pago/fecha de
// ingreso), pago variable, o producción mensual (config_fiscal).
//
// Si no hay sugerencia disponible (fiscal sin configurar o sin datos de
// nómina todavía) no toca configuracion_costeo — así un tenant que no usa
// el módulo de nómina, o que puso el valor a mano antes de tener datos,
// no ve su número pisado sin motivo.
export async function sincronizarCostoIndirectoMano(query, tenantId) {
  const { sugerido } = await calcularSugerenciaManoObra(query, tenantId)
  if (sugerido === null) return null

  await query(`
    INSERT INTO configuracion_costeo (tenant_id, costo_indirecto_mano, actualizado_en)
    VALUES ($1, $2, NOW())
    ON CONFLICT (tenant_id) DO UPDATE SET
      costo_indirecto_mano = EXCLUDED.costo_indirecto_mano,
      actualizado_en = NOW()
  `, [tenantId, sugerido])

  return sugerido
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
