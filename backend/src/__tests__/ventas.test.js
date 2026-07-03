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
import ventasRouter from '../routes/ventas.js'

const app = makeApp(ventasRouter)

const mockVenta = {
  id: 'v-1', fecha: '2024-06-01', total: 100,
  metodo_pago: 'efectivo', canal: 'tienda', cliente: 'Sin nombre',
  items: [{ producto: 'Dona azucarada', cantidad: 5, precio_unit: 20 }],
}

describe('POST /api/ventas — validaciones', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when items is empty', async () => {
    const res = await request(app).post('/').send({ items: [], total: 100 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/item/i)
  })

  it('returns 400 when total is 0', async () => {
    const items = [{ producto: 'Dona', cantidad: 1, precio_unit: 20 }]
    const res = await request(app).post('/').send({ items, total: 0 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/total/i)
  })

  it('returns 400 when declared total does not match items sum', async () => {
    const items = [{ producto: 'Dona', cantidad: 5, precio_unit: 20 }]
    const res = await request(app).post('/').send({ items, total: 50 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/no coincide/i)
  })

  it('creates venta when total matches items sum', async () => {
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'v-1', total: 100 }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: mockVenta.items }),
    }
    transaction.mockImplementation(async (fn) => fn(mockClient))

    const items = [{ producto: 'Dona azucarada', cantidad: 5, precio_unit: 20 }]
    const res = await request(app).post('/').send({ items, total: 100 })
    expect(res.status).toBe(201)
    expect(res.body.total).toBe(100)
  })
})

describe('GET /api/ventas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ventas list', async () => {
    query.mockResolvedValueOnce({ rows: [mockVenta] })
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body[0].id).toBe('v-1')
  })

  it('passes fecha filter when provided', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    await request(app).get('/?fecha=2024-06-01')
    const params = query.mock.calls[0][1]
    expect(params).toContain('2024-06-01')
  })

  it('filters by desde/hasta range', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    await request(app).get('/?desde=2024-06-01&hasta=2024-06-30')
    const [sql, params] = query.mock.calls[0]
    expect(sql).toMatch(/v\.fecha >= \$2/)
    expect(sql).toMatch(/v\.fecha <= \$3/)
    expect(params).toEqual(expect.arrayContaining(['2024-06-01', '2024-06-30']))
  })

  it('filters by sucursal_id and producto', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    await request(app).get('/?sucursal_id=suc-1&producto=Dona')
    const [sql, params] = query.mock.calls[0]
    expect(sql).toMatch(/v\.sucursal_id = \$2/)
    expect(sql).toMatch(/vi2\.producto ILIKE \$3/)
    expect(params).toEqual(expect.arrayContaining(['suc-1', '%Dona%']))
  })
})

describe('GET /api/ventas/resumen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('defaults to today (Nicaragua) when no date filter given', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total_ventas: 0, ingresos: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
    await request(app).get('/resumen')
    const sql = query.mock.calls[0][0]
    expect(sql).toMatch(/America\/Managua/)
  })

  it('uses desde/hasta range instead of today when provided', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total_ventas: 2, ingresos: 200 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ sucursal: 'Central', total: 200 }] })
    const res = await request(app).get('/resumen?desde=2024-06-01&hasta=2024-06-30')
    const sql = query.mock.calls[0][0]
    expect(sql).not.toMatch(/America\/Managua/)
    expect(res.body.por_sucursal).toEqual([{ sucursal: 'Central', total: 200 }])
  })
})

describe('DELETE /api/ventas/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes venta and returns ok', async () => {
    query.mockResolvedValueOnce({ rowCount: 1 })
    const res = await request(app).delete('/v-1')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 404 when venta not found', async () => {
    query.mockResolvedValueOnce({ rowCount: 0 })
    const res = await request(app).delete('/no-existe')
    expect(res.status).toBe(404)
  })
})
