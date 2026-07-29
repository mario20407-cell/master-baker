import { describe, it, expect, vi } from 'vitest'
import { obtenerColaboradoresConDatosLaborales } from '../pasivosLaboralesService.js'

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
