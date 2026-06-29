import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { makeApp } from './test-utils.js'

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}))

import { query } from '../db/client.js'
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
