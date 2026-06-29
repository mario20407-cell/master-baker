import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { makeApp } from './test-utils.js'

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}))

import { query, transaction } from '../db/client.js'
import recetasRouter from '../routes/recetas.js'

const app = makeApp(recetasRouter)

const mockReceta = {
  id: 'r-1', producto: 'Dona azucarada', piezas: 12,
  peso_por_pieza: 60, merma_pct: 5, notas: '',
  ingredientes: [{ nombre: 'Harina', cantidad: 0.5, unidad: 'kg', precio: 12.5, tipo: 'directo' }],
}

describe('GET /api/recetas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all recetas with ingredients', async () => {
    query.mockResolvedValueOnce({ rows: [mockReceta] })
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body[0].producto).toBe('Dona azucarada')
    expect(res.body[0].ingredientes).toHaveLength(1)
  })

  it('defaults ingredientes to [] when null', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...mockReceta, ingredientes: null }] })
    const res = await request(app).get('/')
    expect(res.body[0].ingredientes).toEqual([])
  })
})

describe('GET /api/recetas/:producto', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns single receta by product name', async () => {
    query.mockResolvedValueOnce({ rows: [mockReceta] })
    const res = await request(app).get('/Dona%20azucarada')
    expect(res.status).toBe(200)
    expect(res.body.producto).toBe('Dona azucarada')
  })

  it('returns 404 when receta not found', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).get('/Producto%20Inexistente')
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/no encontrada/i)
  })
})

describe('POST /api/recetas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates receta and returns 201', async () => {
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'r-1', producto: 'Dona azucarada', piezas: 12 }] })
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rowCount: 1 }),
    }
    transaction.mockImplementation(async (fn) => fn(mockClient))
    query.mockResolvedValueOnce({ rows: [mockReceta] })

    const res = await request(app).post('/').send({
      producto: 'Dona azucarada',
      piezas: 12,
      ingredientes: [{ nombre: 'Harina', cantidad: 0.5, unidad: 'kg', precio: 12.5 }],
    })
    expect(res.status).toBe(201)
    expect(res.body.producto).toBe('Dona azucarada')
  })

  it('returns 400 when producto is missing', async () => {
    const res = await request(app).post('/').send({ piezas: 12 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/producto/i)
  })

  it('returns 400 when piezas is missing', async () => {
    const res = await request(app).post('/').send({ producto: 'Dona azucarada' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/piezas/i)
  })
})

describe('DELETE /api/recetas/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes receta and returns ok', async () => {
    query.mockResolvedValueOnce({ rowCount: 1 })
    const res = await request(app).delete('/r-1')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 404 when receta not found', async () => {
    query.mockResolvedValueOnce({ rowCount: 0 })
    const res = await request(app).delete('/no-existe')
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/no encontrada/i)
  })
})
