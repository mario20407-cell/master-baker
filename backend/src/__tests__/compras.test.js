import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { makeApp } from './test-utils.js'

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}))

import { query, transaction } from '../db/client.js'
import comprasRouter from '../routes/compras.js'

const app = makeApp(comprasRouter)

const mockFactura = {
  id: 'f-1', proveedor: 'Distribuidora López', fecha: '2024-06-01',
  total: 500, notas: '',
  items: [{ producto: 'Harina', cantidad: 10, precio_actual: 50, variacion_pct: null, alerta: false }],
}

describe('GET /api/compras', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns facturas with items', async () => {
    query.mockResolvedValueOnce({ rows: [mockFactura] })
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body[0].proveedor).toBe('Distribuidora López')
  })
})

describe('POST /api/compras', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when items array is empty', async () => {
    const res = await request(app).post('/').send({ proveedor: 'Test', items: [] })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/items/i)
  })

  it('creates factura with items and returns 201', async () => {
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'f-1', proveedor: 'Distribuidora', total: 500 }] })
        .mockResolvedValueOnce({ rowCount: 1 }),
    }
    transaction.mockImplementation(async (fn) => fn(mockClient))
    query.mockResolvedValueOnce({ rows: [mockFactura] })

    const res = await request(app).post('/').send({
      proveedor: 'Distribuidora',
      items: [{ producto: 'Harina', cantidad: 10, precio_actual: 50, precio_anterior: 45 }],
    })
    expect(res.status).toBe(201)
    expect(res.body.proveedor).toBe('Distribuidora López')
  })

  it('computes alerta=true when price increases > 10%', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: 'f-2', total: 60 }] }),
    }
    transaction.mockImplementation(async (fn) => fn(mockClient))
    query.mockResolvedValueOnce({ rows: [mockFactura] })

    await request(app).post('/').send({
      proveedor: 'Test',
      items: [{ producto: 'Azúcar', cantidad: 1, precio_actual: 60, precio_anterior: 50 }],
    })

    const itemInsertCall = mockClient.query.mock.calls[1]
    const alertaArg = itemInsertCall[1][7]
    expect(alertaArg).toBe(true)
  })

  it('computes alerta=false when price change <= 10%', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: 'f-3', total: 55 }] }),
    }
    transaction.mockImplementation(async (fn) => fn(mockClient))
    query.mockResolvedValueOnce({ rows: [mockFactura] })

    await request(app).post('/').send({
      proveedor: 'Test',
      items: [{ producto: 'Mantequilla', cantidad: 1, precio_actual: 55, precio_anterior: 50 }],
    })

    const itemInsertCall = mockClient.query.mock.calls[1]
    const alertaArg = itemInsertCall[1][7]
    expect(alertaArg).toBe(false)
  })
})
