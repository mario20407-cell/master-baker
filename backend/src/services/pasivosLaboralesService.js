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

  const aplicaInss = await obtenerAplicaInss(query, tenantId)
  const hoy = new Date()
  let sumaCostoLaboralTotal = 0
  let colaboradoresConSueldo = 0

  for (const c of colaboradoresValidos) {
    const base = calcularBaseSalarial(c, c.pagosVariables)
    if (base.sinDatos) continue

    const inss = calcularInssPatronalMensual(base.inssPatronal, empresaGrande, aplicaInss)
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

// aplicaInss = false para negocios que no cotizan al INSS/INATEC (común en
// el sector informal nicaragüense) — en ese caso no hay carga patronal real
// que provisionar, así que todo sale en 0 en vez de un número que el
// negocio nunca va a pagar.
export function calcularInssPatronalMensual(inssPatronalBase, empresaGrande = false, aplicaInss = true) {
  if (!aplicaInss) return { patronal: 0, inatec: 0, total: 0, tasaPatronal: 0 }
  const tasaPatronal = empresaGrande ? TASAS.INSS_PATRONAL_GRANDE : TASAS.INSS_PATRONAL
  const patronal = inssPatronalBase * tasaPatronal
  const inatec = inssPatronalBase * TASAS.INATEC
  return { patronal, inatec, total: patronal + inatec, tasaPatronal }
}

// Lee el switch por-tenant de configuracion_costeo. Default true (el
// comportamiento legal esperado) si el tenant todavía no tiene fila en la
// tabla — mismo default que la columna en schema.sql.
export async function obtenerAplicaInss(query, tenantId) {
  const { rows } = await query(
    'SELECT aplica_inss FROM configuracion_costeo WHERE tenant_id = $1',
    [tenantId]
  )
  return rows.length ? rows[0].aplica_inss !== false : true
}

// ── Planilla (nómina periódica) ─────────────────────────────────────────────
//
// Distinto del dossier de pasivos laborales (que son provisiones acumuladas
// de aguinaldo/vacaciones/indemnización): la planilla es el pago real de un
// período concreto — lo que hay que depositar/entregar a cada colaborador
// esta semana/quincena/mes, más lo que el negocio le debe al INSS por ese
// mismo período.
//
// La mayoría de colaboradores de panadería cobran semanal o quincenal, no
// mensual, así que salario_mensual (la base que se guarda en el perfil
// laboral) se prorratea según la frecuencia elegida al generar la planilla.
export const FACTOR_FRECUENCIA = {
  mensual: 1,
  quincenal: 0.5,
  semanal: 7 / DIAS_POR_MES,
}

export function calcularFinPeriodo(frecuencia, periodoInicio) {
  // 'YYYY-MM-DD' se parsea como medianoche UTC — hay que mutar y leer con
  // los métodos getUTC*/setUTC* (no los locales) para no correr el
  // riesgo de un desfase de un día según la zona horaria del servidor.
  const inicio = new Date(periodoInicio)
  const fin = new Date(inicio)
  if (frecuencia === 'semanal') fin.setUTCDate(fin.getUTCDate() + 6)
  else if (frecuencia === 'quincenal') fin.setUTCDate(fin.getUTCDate() + 14)
  else fin.setUTCMonth(fin.getUTCMonth() + 1, fin.getUTCDate() - 1) // mensual: día anterior, un mes después
  return fin.toISOString().slice(0, 10)
}

function redondear(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

// Calcula la planilla de un período sin guardar nada (vista previa).
// Colaboradores de pago variable: se usa el pago variable registrado para
// el mes calendario en el que cae periodoInicio, prorrateado igual que el
// salario fijo — no hay desglose semanal real para pago variable, así que
// es una aproximación (se documenta en la UI).
export async function calcularPlanilla(query, tenantId, frecuencia, periodoInicio) {
  if (!FACTOR_FRECUENCIA[frecuencia]) {
    throw new Error(`frecuencia inválida: ${frecuencia} (usar semanal, quincenal o mensual)`)
  }
  const factor = FACTOR_FRECUENCIA[frecuencia]
  const periodoFin = calcularFinPeriodo(frecuencia, periodoInicio)
  const mesPeriodo = String(periodoInicio).slice(0, 7) // YYYY-MM

  const { colaboradores, empresaGrande } = await obtenerColaboradoresConDatosLaborales(query, tenantId)
  const aplicaInss = await obtenerAplicaInss(query, tenantId)

  const detalle = []
  for (const c of colaboradores) {
    let salarioMensualBase = 0
    if (c.tipo_pago === 'fijo') {
      salarioMensualBase = Number(c.salario_mensual) || 0
    } else if (c.tipo_pago === 'variable') {
      const pagoDelMes = (c.pagosVariables || []).find(p => String(p.mes).slice(0, 7) === mesPeriodo)
      salarioMensualBase = pagoDelMes ? Number(pagoDelMes.monto) : 0
    }
    if (salarioMensualBase <= 0) continue // sin datos suficientes para incluirlo en este período

    const salarioBruto = redondear(salarioMensualBase * factor)
    // Sin INSS no hay retención al colaborador — se le paga el bruto completo.
    const inssLaboral = aplicaInss ? redondear(salarioBruto * TASAS.INSS_LABORAL) : 0
    const netoAPagar = redondear(salarioBruto - inssLaboral)
    const inss = calcularInssPatronalMensual(salarioBruto, empresaGrande, aplicaInss)

    detalle.push({
      usuario_id: c.id,
      nombre: c.nombre,
      tipo_pago: c.tipo_pago,
      salario_bruto: salarioBruto,
      inss_laboral: inssLaboral,
      neto_a_pagar: netoAPagar,
      inss_patronal: redondear(inss.patronal),
      inatec: redondear(inss.inatec),
    })
  }

  const totales = detalle.reduce((acc, d) => ({
    bruto: acc.bruto + d.salario_bruto,
    inssLaboral: acc.inssLaboral + d.inss_laboral,
    neto: acc.neto + d.neto_a_pagar,
    inssPatronal: acc.inssPatronal + d.inss_patronal,
    inatec: acc.inatec + d.inatec,
  }), { bruto: 0, inssLaboral: 0, neto: 0, inssPatronal: 0, inatec: 0 })

  return { frecuencia, periodoInicio, periodoFin, empresaGrande, aplicaInss, detalle, totales }
}

// Genera y guarda la planilla de un período (upsert por tenant_id +
// periodo_inicio — si ya existía, se recalcula y se reemplaza el detalle
// completo, útil si algún salario cambió después de generarla la primera vez).
export async function generarPlanilla(query, tenantId, frecuencia, periodoInicio, generadoPor = null) {
  const c = await calcularPlanilla(query, tenantId, frecuencia, periodoInicio)

  const { rows } = await query(`
    INSERT INTO planillas (
      tenant_id, frecuencia, periodo_inicio, periodo_fin, generado_por,
      empresa_grande, aplica_inss, total_bruto, total_inss_laboral, total_neto,
      total_inss_patronal, total_inatec
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (tenant_id, periodo_inicio) DO UPDATE SET
      frecuencia = EXCLUDED.frecuencia,
      periodo_fin = EXCLUDED.periodo_fin,
      generado_en = NOW(),
      generado_por = EXCLUDED.generado_por,
      empresa_grande = EXCLUDED.empresa_grande,
      aplica_inss = EXCLUDED.aplica_inss,
      total_bruto = EXCLUDED.total_bruto,
      total_inss_laboral = EXCLUDED.total_inss_laboral,
      total_neto = EXCLUDED.total_neto,
      total_inss_patronal = EXCLUDED.total_inss_patronal,
      total_inatec = EXCLUDED.total_inatec
    RETURNING id
  `, [
    tenantId, frecuencia, periodoInicio, c.periodoFin, generadoPor,
    c.empresaGrande, c.aplicaInss, c.totales.bruto, c.totales.inssLaboral, c.totales.neto,
    c.totales.inssPatronal, c.totales.inatec,
  ])
  const planillaId = rows[0].id

  await query('DELETE FROM planilla_detalle WHERE planilla_id = $1', [planillaId])

  // INSERT multi-fila en una sola query (nunca un loop de INSERTs por
  // colaborador) — mismo patrón N+1 que ya se corrigió en otros lugares
  // de este módulo (ver obtenerColaboradoresConDatosLaborales).
  if (c.detalle.length > 0) {
    const params = [planillaId]
    const filas = c.detalle.map(d => {
      const base = params.length
      params.push(d.usuario_id, d.nombre, d.tipo_pago, d.salario_bruto, d.inss_laboral, d.neto_a_pagar, d.inss_patronal, d.inatec)
      return `($1, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`
    })
    await query(`
      INSERT INTO planilla_detalle (planilla_id, usuario_id, nombre, tipo_pago, salario_bruto, inss_laboral, neto_a_pagar, inss_patronal, inatec)
      VALUES ${filas.join(',')}
    `, params)
  }

  return { id: planillaId, ...c }
}

export async function obtenerHistorialPlanillas(query, tenantId, limite = 24) {
  const { rows } = await query(`
    SELECT id, frecuencia, periodo_inicio, periodo_fin, generado_en,
           total_bruto, total_neto, total_inss_patronal, total_inatec
    FROM planillas
    WHERE tenant_id = $1
    ORDER BY periodo_inicio DESC
    LIMIT $2
  `, [tenantId, limite])
  return rows
}

export async function obtenerPlanilla(query, tenantId, planillaId) {
  const { rows: planillaRows } = await query(
    'SELECT * FROM planillas WHERE id = $1 AND tenant_id = $2',
    [planillaId, tenantId]
  )
  if (!planillaRows[0]) return null

  const { rows: detalle } = await query(
    `SELECT usuario_id, nombre, tipo_pago, salario_bruto, inss_laboral, neto_a_pagar, inss_patronal, inatec
     FROM planilla_detalle WHERE planilla_id = $1 ORDER BY nombre`,
    [planillaId]
  )
  return { ...planillaRows[0], detalle }
}

// Cálculo consolidado de un colaborador. Devuelve null si no hay fecha de
// ingreso registrada (dato mínimo indispensable para todos los cálculos).
export function calcularPasivoColaborador(colaborador, pagosVariables = [], empresaGrande = false, aplicaInss = true) {
  if (!colaborador.fecha_ingreso) return null

  const hoy = new Date()
  const base = calcularBaseSalarial(colaborador, pagosVariables)
  const aguinaldo = calcularAguinaldoAcumulado(base.aguinaldo, colaborador.fecha_ingreso, hoy)
  const vacaciones = calcularVacacionesAcumuladas(base.vacaciones, colaborador.fecha_ingreso, hoy)
  const indemnizacion = calcularIndemnizacionPotencial(base.indemnizacion, colaborador.fecha_ingreso, hoy)
  const inss = calcularInssPatronalMensual(base.inssPatronal, empresaGrande, aplicaInss)
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
