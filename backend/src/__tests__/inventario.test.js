import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { makeApp } from './test-utils.js'

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}))

import { query, transaction } from '../db/client.js'
import inventarioRouter from '../routes/inventario.js'

const app = makeApp(inventarioRouter)

const mockInsumo = {
  id: 1, nombre: 'Harina', existencia: 50, unidad: 'kg',
  consumo_diario: 5, punto_reposicion: 10, costo_unitario: 25,
}

describe('GET /api/inventario', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns inventory items with estado computed', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...mockInsumo, dias_restantes: 10, estado: 'normal' }] })
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body[0].nombre).toBe('Harina')
    expect(res.body[0].estado).toBe('normal')
  })
})

describe('POST /api/inventario', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates new insumo and returns 201', async () => {
    query.mockResolvedValueOnce({ rows: [mockInsumo] })
    const res = await request(app).post('/').send({ nombre: 'Harina', existencia: 50, unidad: 'kg' })
    expect(res.status).toBe(201)
    expect(res.body.nombre).toBe('Harina')
  })

  it('returns 400 when nombre is missing', async () => {
    const res = await request(app).post('/').send({ existencia: 50 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/nombre/i)
  })
})

describe('POST /api/inventario/importar', () => {
  beforeEach(() => vi.clearAllMocks())

  function mockClientWith(insertedFlags) {
    const clientQuery = vi.fn()
    insertedFlags.forEach((inserted) => clientQuery.mockResolvedValueOnce({ rows: [{ inserted }] }))
    transaction.mockImplementation(async (fn) => fn({ query: clientQuery }))
    return clientQuery
  }

  it('imports mixed insert/update rows and returns summary', async () => {
    mockClientWith([true, false])
    const res = await request(app).post('/importar').send({
      filas: [
        { nombre: 'Azucar', existencia: 20, unidad: 'kg', costo_unitario: 15, punto_reposicion: 5 },
        { nombre: 'Harina', existencia: 50, unidad: 'kg', costo_unitario: 25, punto_reposicion: 10 },
      ],
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ insertados: 1, actualizados: 1, errores: [] })
  })

  it('collects errors for invalid rows without aborting the batch', async () => {
    mockClientWith([true])
    const res = await request(app).post('/importar').send({
      filas: [
        { nombre: '', existencia: 10, costo_unitario: 5 },
        { nombre: 'Existencia negativa', existencia: -1, costo_unitario: 5 },
        { nombre: 'Costo negativo', existencia: 10, costo_unitario: -1 },
        { nombre: 'Insumo valido', existencia: 10, costo_unitario: 5 },
      ],
    })
    expect(res.status).toBe(200)
    expect(res.body.insertados).toBe(1)
    expect(res.body.errores).toHaveLength(3)
  })

  it('returns 400 when filas is not an array', async () => {
    const res = await request(app).post('/importar').send({ filas: null })
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/inventario/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates insumo successfully', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...mockInsumo, existencia: 100 }] })
    const res = await request(app).put('/1').send({ existencia: 100, consumo_diario: 5, punto_reposicion: 10, costo_unitario: 25 })
    expect(res.status).toBe(200)
    expect(res.body.existencia).toBe(100)
  })

  it('returns 404 when insumo not found', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).put('/999').send({ existencia: 10 })
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/no encontrado/i)
  })
})

describe('DELETE /api/inventario/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes insumo successfully', async () => {
    query.mockResolvedValueOnce({ rowCount: 1 })
    const res = await request(app).delete('/1')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 404 when insumo not found', async () => {
    query.mockResolvedValueOnce({ rowCount: 0 })
    const res = await request(app).delete('/999')
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/no encontrado/i)
  })
})
