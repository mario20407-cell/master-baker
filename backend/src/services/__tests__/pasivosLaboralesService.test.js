import { describe, it, expect, vi } from 'vitest'
import { obtenerColaboradoresConDatosLaborales, calcularSugerenciaManoObra, sincronizarCostoIndirectoMano } from '../pasivosLaboralesService.js'

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
