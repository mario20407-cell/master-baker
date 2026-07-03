import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { makeApp } from './test-utils.js'

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('../middleware/authMiddleware.js', () => ({
  requireAuth: (req, res, next) => {
    req.usuarioId = 'u-1'
    req.tenantId = 'test-tenant-id'
    req.rol = 'admin'
    req.email = 'test@marquez.com'
    req.nombre = 'Test User'
    next()
  },
  requireRol: () => (req, res, next) => next(),
}))

import { query, transaction } from '../db/client.js'
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

describe('POST /api/catalogo/importar', () => {
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
        { nombre: 'Dona nueva', precio: 15, categoria: 'Donas', presentacion: 'unidad' },
        { nombre: 'Croissant', precio: 55, categoria: 'Hojaldre', presentacion: 'unidad' },
      ],
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ insertados: 1, actualizados: 1, errores: [] })
  })

  it('collects errors for invalid rows without aborting the batch', async () => {
    mockClientWith([true])
    const res = await request(app).post('/importar').send({
      filas: [
        { nombre: '', precio: 10 },
        { nombre: 'Precio invalido', precio: 0 },
        { nombre: 'Dona valida', precio: 12 },
      ],
    })
    expect(res.status).toBe(200)
    expect(res.body.insertados).toBe(1)
    expect(res.body.errores).toHaveLength(2)
    expect(res.body.errores[0]).toEqual({ fila: 1, motivo: expect.stringMatching(/nombre/i) })
    expect(res.body.errores[1]).toEqual({ fila: 2, motivo: expect.stringMatching(/precio/i) })
  })

  it('returns 400 when filas is not an array', async () => {
    const res = await request(app).post('/importar').send({ filas: 'nope' })
    expect(res.status).toBe(400)
  })

  it('scopes the upsert query to the tenant', async () => {
    const clientQuery = mockClientWith([true])
    await request(app).post('/importar').send({ filas: [{ nombre: 'Dona', precio: 10 }] })
    expect(clientQuery).toHaveBeenCalledWith(expect.any(String), ['test-tenant-id', 'Dona', 10, null, 'unidad'])
  })
})
