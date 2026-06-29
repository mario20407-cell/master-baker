import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { makeApp } from './test-utils.js'

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}))

import { query } from '../db/client.js'
import catalogoRouter from '../routes/catalogo.js'

const app = makeApp(catalogoRouter)

const mockProductos = [
  { id: 1, nombre: 'Dona azucarada', categoria: 'Donas', precio: 20, tiene_receta: false },
  { id: 2, nombre: 'Croissant', categoria: 'Hojaldre', precio: 50, tiene_receta: true },
]

describe('GET /api/catalogo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns products array', async () => {
    query.mockResolvedValueOnce({ rows: mockProductos })
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].nombre).toBe('Dona azucarada')
  })

  it('passes tenantId to query', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    await request(app).get('/')
    expect(query).toHaveBeenCalledWith(expect.any(String), ['test-tenant-id'])
  })

  it('returns empty array when no products', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('PUT /api/catalogo/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates producto and returns updated row', async () => {
    const updated = { ...mockProductos[0], precio: 25 }
    query.mockResolvedValueOnce({ rows: [updated] })
    const res = await request(app).put('/1').send({ precio: 25, presentacion: 'unidad' })
    expect(res.status).toBe(200)
    expect(res.body.precio).toBe(25)
  })

  it('returns 404 when product not found for tenant', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).put('/999').send({ precio: 99, presentacion: 'unidad' })
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/no encontrado/i)
  })
})
