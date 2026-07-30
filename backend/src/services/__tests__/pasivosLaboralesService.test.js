import { describe, it, expect, vi } from 'vitest'
import {
  obtenerColaboradoresConDatosLaborales, calcularSugerenciaManoObra, sincronizarCostoIndirectoMano,
  calcularFinPeriodo, calcularPlanilla, generarPlanilla, calcularInssPatronalMensual, obtenerAplicaInss,
  calcularPasivoColaborador,
} from '../pasivosLaboralesService.js'

// Antes, recetas.js (sugerencia-mano-obra) y pasivosLaborales.js (dossier)
// hacían 1 query de pagos_variables POR colaborador de pago variable,
// dentro de un loop (N+1). Este test verifica que el helper compartido
// se mantenga en 2 queries sin importar cuántos colaboradores haya, y que
// el agrupamiento de pagos por usuario sea correcto.
describe('obtenerColaboradoresConDatosLaborales', () => {
  const usuarios = [
    { id: 'a', nombre: 'A', tipo_pago: 'fijo', salario_mensual: 100, fecha_ingreso: '2020-01-01' },
    { id: 'b', nombre: 'B', tipo_pago: 'variable', salario_mensual: null, fecha_ingreso: '2021-01-01' },
    { id: 'c', nombre: 'C', tipo_pago: 'variable', salario_mensual: null, fecha_ingreso: '2022-01-01' },
  ]
  const pagos = [
    { usuario_id: 'b', mes: '2026-07-01', monto: 500 },
    { usuario_id: 'b', mes: '2026-06-01', monto: 400 },
    { usuario_id: 'c', mes: '2026-07-01', monto: 900 },
  ]

  function crearQueryFalso() {
    return vi.fn(async (sql, params) => {
      if (sql.includes('FROM usuarios')) return { rows: usuarios }
      if (sql.includes('FROM pagos_variables')) {
        const ids = params[0]
        return { rows: pagos.filter(p => ids.includes(p.usuario_id)) }
      }
      throw new Error('query inesperada: ' + sql)
    })
  }

  it('hace exactamente 2 queries, sin importar cuántos colaboradores de pago variable haya', async () => {
    const queryFalso = crearQueryFalso()
    await obtenerColaboradoresConDatosLaborales(queryFalso, 'tenant-x')
    expect(queryFalso).toHaveBeenCalledTimes(2)
  })

  it('agrupa los pagos variables por colaborador correctamente', async () => {
    const { colaboradores } = await obtenerColaboradoresConDatosLaborales(crearQueryFalso(), 'tenant-x')
    const b = colaboradores.find(c => c.id === 'b')
    expect(b.pagosVariables).toEqual([
      { mes: '2026-07-01', monto: 500 },
      { mes: '2026-06-01', monto: 400 },
    ])
  })

  it('colaboradores de pago fijo no traen pagos variables', async () => {
    const { colaboradores } = await obtenerColaboradoresConDatosLaborales(crearQueryFalso(), 'tenant-x')
    const a = colaboradores.find(c => c.id === 'a')
    expect(a.pagosVariables).toEqual([])
  })

  it('no rompe si no hay ningún colaborador de pago variable (evita el IN vacío)', async () => {
    const queryFalso = vi.fn(async (sql) => {
      if (sql.includes('FROM usuarios')) {
        return { rows: [{ id: 'a', nombre: 'A', tipo_pago: 'fijo', salario_mensual: 100, fecha_ingreso: '2020-01-01' }] }
      }
      throw new Error('no debería consultar pagos_variables si no hay colaboradores variables')
    })
    const { colaboradores } = await obtenerColaboradoresConDatosLaborales(queryFalso, 'tenant-x')
    expect(queryFalso).toHaveBeenCalledTimes(1)
    expect(colaboradores[0].pagosVariables).toEqual([])
  })

  it('empresaGrande es true con 50+ colaboradores activos', async () => {
    const usuarios50 = Array.from({ length: 50 }, (_, i) => ({
      id: `u${i}`, nombre: `U${i}`, tipo_pago: 'fijo', salario_mensual: 100, fecha_ingreso: '2020-01-01',
    }))
    const queryFalso = vi.fn(async (sql) => ({ rows: usuarios50 }))
    const { empresaGrande } = await obtenerColaboradoresConDatosLaborales(queryFalso, 'tenant-x')
    expect(empresaGrande).toBe(true)
  })
})

// calcularSugerenciaManoObra y sincronizarCostoIndirectoMano — la parte
// nueva: automatizar el número de mano de obra que se jala al costeo de
// recetas, en vez de depender de que alguien apriete "usar sugerencia" a
// mano en Configuración cada vez que cambia la nómina.
describe('calcularSugerenciaManoObra / sincronizarCostoIndirectoMano', () => {
  const fiscalConfigurado = { produccion_mensual: 100, configurado: true }
  const usuarioFijo = { id: 'a', nombre: 'A', tipo_pago: 'fijo', salario_mensual: 1000, fecha_ingreso: '2020-01-01' }

  function crearQueryFalso({ fiscal = fiscalConfigurado, usuarios = [usuarioFijo], pagos = [] } = {}) {
    return vi.fn(async (sql, params) => {
      if (sql.includes('FROM config_fiscal')) return { rows: fiscal ? [fiscal] : [] }
      if (sql.includes('FROM usuarios')) return { rows: usuarios }
      if (sql.includes('FROM pagos_variables')) {
        const ids = params[0]
        return { rows: pagos.filter(p => ids.includes(p.usuario_id)) }
      }
      if (sql.includes('SELECT aplica_inss FROM configuracion_costeo')) return { rows: [] }
      if (sql.includes('INSERT INTO configuracion_costeo')) return { rows: [] }
      throw new Error('query inesperada: ' + sql)
    })
  }

  it('devuelve motivo fiscal_no_configurado si config_fiscal no existe o configurado=false', async () => {
    const queryFalso = crearQueryFalso({ fiscal: null })
    const resultado = await calcularSugerenciaManoObra(queryFalso, 'tenant-x')
    expect(resultado).toEqual({ sugerido: null, motivo: 'fiscal_no_configurado' })
  })

  it('devuelve motivo sin_produccion_mensual si produccion_mensual es 0', async () => {
    const queryFalso = crearQueryFalso({ fiscal: { produccion_mensual: 0, configurado: true } })
    const resultado = await calcularSugerenciaManoObra(queryFalso, 'tenant-x')
    expect(resultado).toEqual({ sugerido: null, motivo: 'sin_produccion_mensual' })
  })

  it('devuelve motivo sin_datos_nomina si no hay colaboradores con pago configurado', async () => {
    const queryFalso = crearQueryFalso({ usuarios: [] })
    const resultado = await calcularSugerenciaManoObra(queryFalso, 'tenant-x')
    expect(resultado).toEqual({ sugerido: null, motivo: 'sin_datos_nomina' })
  })

  it('calcula un sugerido positivo cuando hay fiscal configurado y nómina con datos', async () => {
    const queryFalso = crearQueryFalso()
    const resultado = await calcularSugerenciaManoObra(queryFalso, 'tenant-x')
    expect(resultado.motivo).toBeNull()
    expect(resultado.sugerido).toBeGreaterThan(0)
  })

  it('sincronizarCostoIndirectoMano NO escribe en configuracion_costeo si no hay sugerencia', async () => {
    const queryFalso = crearQueryFalso({ fiscal: null })
    const resultado = await sincronizarCostoIndirectoMano(queryFalso, 'tenant-x')
    expect(resultado).toBeNull()
    expect(queryFalso).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO configuracion_costeo'), expect.anything())
  })

  it('sincronizarCostoIndirectoMano escribe el valor sugerido en configuracion_costeo cuando sí hay datos', async () => {
    const queryFalso = crearQueryFalso()
    const resultado = await sincronizarCostoIndirectoMano(queryFalso, 'tenant-x')
    expect(resultado).toBeGreaterThan(0)
    const llamadaInsert = queryFalso.mock.calls.find(([sql]) => sql.includes('INSERT INTO configuracion_costeo'))
    expect(llamadaInsert).toBeTruthy()
    expect(llamadaInsert[1]).toEqual(['tenant-x', resultado])
  })
})

// Planilla (nómina periódica) — distinto del dossier de pasivos: acá se
// calcula el pago real de un período concreto (semanal/quincenal/mensual),
// no una provisión acumulada.
describe('calcularFinPeriodo', () => {
  it('semanal: 6 días después del inicio (período de 7 días)', () => {
    expect(calcularFinPeriodo('semanal', '2026-07-27')).toBe('2026-08-02')
  })

  it('quincenal: 14 días después del inicio (período de 15 días)', () => {
    expect(calcularFinPeriodo('quincenal', '2026-07-01')).toBe('2026-07-15')
  })

  it('mensual: un mes después, un día antes', () => {
    expect(calcularFinPeriodo('mensual', '2026-07-01')).toBe('2026-07-31')
  })

  it('mensual cruza correctamente fin de año', () => {
    expect(calcularFinPeriodo('mensual', '2026-12-15')).toBe('2027-01-14')
  })
})

describe('calcularPlanilla', () => {
  const usuarioFijo = { id: 'a', nombre: 'Ana', tipo_pago: 'fijo', salario_mensual: 9000, fecha_ingreso: '2020-01-01' }
  const usuarioVariable = { id: 'b', nombre: 'Beto', tipo_pago: 'variable', salario_mensual: null, fecha_ingreso: '2021-01-01' }
  const usuarioSinDatos = { id: 'c', nombre: 'Carla', tipo_pago: 'fijo', salario_mensual: 0, fecha_ingreso: '2022-01-01' }

  function crearQueryFalso({ usuarios = [usuarioFijo], pagos = [], aplicaInss = true } = {}) {
    return vi.fn(async (sql, params) => {
      if (sql.includes('FROM usuarios')) return { rows: usuarios }
      if (sql.includes('FROM pagos_variables')) {
        const ids = params[0]
        return { rows: pagos.filter(p => ids.includes(p.usuario_id)) }
      }
      if (sql.includes('FROM configuracion_costeo')) return { rows: [{ aplica_inss: aplicaInss }] }
      throw new Error('query inesperada: ' + sql)
    })
  }

  it('rechaza una frecuencia inválida', async () => {
    await expect(calcularPlanilla(crearQueryFalso(), 'tenant-x', 'diaria', '2026-07-01')).rejects.toThrow(/frecuencia inválida/)
  })

  it('mensual: salario bruto = salario_mensual completo', async () => {
    const r = await calcularPlanilla(crearQueryFalso(), 'tenant-x', 'mensual', '2026-07-01')
    expect(r.detalle).toHaveLength(1)
    expect(r.detalle[0].salario_bruto).toBe(9000)
    expect(r.detalle[0].inss_laboral).toBeCloseTo(9000 * 0.07, 2)
    expect(r.detalle[0].neto_a_pagar).toBeCloseTo(9000 - 9000 * 0.07, 2)
  })

  it('quincenal: salario bruto = mitad del salario mensual', async () => {
    const r = await calcularPlanilla(crearQueryFalso(), 'tenant-x', 'quincenal', '2026-07-01')
    expect(r.detalle[0].salario_bruto).toBe(4500)
  })

  it('semanal: salario bruto prorrateado (~7/30.4375 del mensual)', async () => {
    const r = await calcularPlanilla(crearQueryFalso(), 'tenant-x', 'semanal', '2026-07-01')
    expect(r.detalle[0].salario_bruto).toBeCloseTo(9000 * (7 / 30.4375), 1)
  })

  it('colaborador de pago variable usa el pago del mes calendario del período', async () => {
    const pagos = [{ usuario_id: 'b', mes: '2026-07-01', monto: 3000 }]
    const r = await calcularPlanilla(crearQueryFalso({ usuarios: [usuarioVariable], pagos }), 'tenant-x', 'mensual', '2026-07-15')
    expect(r.detalle).toHaveLength(1)
    expect(r.detalle[0].salario_bruto).toBe(3000)
  })

  it('excluye colaboradores sin datos suficientes para el período (salario 0 o sin pago variable ese mes)', async () => {
    const r = await calcularPlanilla(crearQueryFalso({ usuarios: [usuarioFijo, usuarioSinDatos, usuarioVariable] }), 'tenant-x', 'mensual', '2026-07-01')
    expect(r.detalle.map(d => d.usuario_id)).toEqual(['a'])
  })

  it('totales son la suma de cada colaborador incluido', async () => {
    const r = await calcularPlanilla(crearQueryFalso(), 'tenant-x', 'mensual', '2026-07-01')
    expect(r.totales.bruto).toBeCloseTo(r.detalle.reduce((s, d) => s + d.salario_bruto, 0), 2)
    expect(r.totales.neto).toBeCloseTo(r.detalle.reduce((s, d) => s + d.neto_a_pagar, 0), 2)
  })

  it('con aplicaInss=false: bruto = neto, sin INSS laboral ni cargas patronales', async () => {
    const r = await calcularPlanilla(crearQueryFalso({ aplicaInss: false }), 'tenant-x', 'mensual', '2026-07-01')
    expect(r.aplicaInss).toBe(false)
    expect(r.detalle[0].inss_laboral).toBe(0)
    expect(r.detalle[0].neto_a_pagar).toBe(r.detalle[0].salario_bruto)
    expect(r.detalle[0].inss_patronal).toBe(0)
    expect(r.detalle[0].inatec).toBe(0)
  })

  it('sin fila en configuracion_costeo, aplicaInss por defecto es true', async () => {
    const queryFalso = vi.fn(async (sql) => {
      if (sql.includes('FROM usuarios')) return { rows: [usuarioFijo] }
      if (sql.includes('FROM configuracion_costeo')) return { rows: [] }
      throw new Error('query inesperada: ' + sql)
    })
    const r = await calcularPlanilla(queryFalso, 'tenant-x', 'mensual', '2026-07-01')
    expect(r.aplicaInss).toBe(true)
    expect(r.detalle[0].inss_laboral).toBeGreaterThan(0)
  })
})

describe('calcularInssPatronalMensual', () => {
  it('con aplicaInss=false devuelve todo en 0', () => {
    expect(calcularInssPatronalMensual(10000, false, false)).toEqual({ patronal: 0, inatec: 0, total: 0, tasaPatronal: 0 })
  })

  it('con aplicaInss=true (default) calcula normal', () => {
    const r = calcularInssPatronalMensual(10000, false)
    expect(r.patronal).toBeCloseTo(2150, 2)
    expect(r.inatec).toBeCloseTo(200, 2)
  })
})

describe('calcularPasivoColaborador con aplicaInss', () => {
  const colaborador = { id: 'a', nombre: 'Ana', tipo_pago: 'fijo', salario_mensual: 9000, fecha_ingreso: '2020-01-01' }

  it('aplicaInss=false deja inssPatronalMensual en 0', () => {
    const r = calcularPasivoColaborador(colaborador, [], false, false)
    expect(r.inssPatronalMensual.total).toBe(0)
  })

  it('aplicaInss=true (default) calcula el INSS patronal normal', () => {
    const r = calcularPasivoColaborador(colaborador, [], false, true)
    expect(r.inssPatronalMensual.total).toBeGreaterThan(0)
  })
})

describe('obtenerAplicaInss', () => {
  it('devuelve true si el tenant no tiene fila en configuracion_costeo', async () => {
    const queryFalso = vi.fn(async () => ({ rows: [] }))
    expect(await obtenerAplicaInss(queryFalso, 'tenant-x')).toBe(true)
  })

  it('devuelve el valor guardado si existe la fila', async () => {
    const queryFalso = vi.fn(async () => ({ rows: [{ aplica_inss: false }] }))
    expect(await obtenerAplicaInss(queryFalso, 'tenant-x')).toBe(false)
  })
})

describe('generarPlanilla', () => {
  const usuarioFijo = { id: 'a', nombre: 'Ana', tipo_pago: 'fijo', salario_mensual: 9000, fecha_ingreso: '2020-01-01' }

  function crearQueryFalso() {
    const llamadas = []
    const fn = vi.fn(async (sql, params) => {
      llamadas.push({ sql, params })
      if (sql.includes('FROM usuarios')) return { rows: [usuarioFijo] }
      if (sql.includes('FROM pagos_variables')) return { rows: [] }
      if (sql.includes('FROM configuracion_costeo')) return { rows: [] }
      if (sql.includes('INSERT INTO planillas')) return { rows: [{ id: 'planilla-1' }] }
      if (sql.includes('DELETE FROM planilla_detalle')) return { rows: [] }
      if (sql.includes('INSERT INTO planilla_detalle')) return { rows: [] }
      throw new Error('query inesperada: ' + sql)
    })
    fn.llamadas = llamadas
    return fn
  }

  it('guarda la planilla con un único INSERT multi-fila en planilla_detalle (no un loop por colaborador)', async () => {
    const queryFalso = crearQueryFalso()
    await generarPlanilla(queryFalso, 'tenant-x', 'mensual', '2026-07-01', 'usuario-admin')
    const insertsDetalle = queryFalso.llamadas.filter(l => l.sql.includes('INSERT INTO planilla_detalle'))
    expect(insertsDetalle).toHaveLength(1)
  })

  it('devuelve el id de la planilla generada junto con el cálculo', async () => {
    const resultado = await generarPlanilla(crearQueryFalso(), 'tenant-x', 'mensual', '2026-07-01')
    expect(resultado.id).toBe('planilla-1')
    expect(resultado.detalle).toHaveLength(1)
  })
})
