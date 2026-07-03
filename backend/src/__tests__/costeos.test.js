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

import { query } from '../db/client.js'
import costeosRouter from '../routes/costeos.js'

const app = makeApp(costeosRouter)

const mockCosteo = {
  id: 1, producto: 'Dona azucarada', piezas_obj: 100,
  costo_total: 430, costo_unitario: 4.3, precio_venta: 20,
  margen_pct: 78.5, aprobado: true,
}

describe('GET /api/costeos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns costeos list', async () => {
    query.mockResolvedValueOnce({ rows: [mockCosteo] })
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body[0].producto).toBe('Dona azucarada')
  })

  it('passes producto filter when provided', async () => {
    query.mockResolvedValueOnce({ rows: [mockCosteo] })
    await request(app).get('/?producto=Dona azucarada')
    const callArgs = query.mock.calls[0]
    expect(callArgs[0]).toContain('producto')
  })

  it('defaults to limit 50', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    await request(app).get('/')
    const callArgs = query.mock.calls[0]
    expect(callArgs[1]).toContain(50)
  })
})

describe('POST /api/costeos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates costeo and sets aprobado=true when margen_pct >= 57', async () => {
    const saved = { ...mockCosteo, aprobado: true }
    query.mockResolvedValueOnce({ rows: [saved] })
    const res = await request(app).post('/').send({
      producto: 'Dona azucarada', piezas_obj: 100, piezas_reales: 98,
      costo_directo: 350, costo_indirecto: 80, costo_total: 430,
      costo_unitario: 4.3, precio_venta: 20, margen_pct: 78.5,
    })
    expect(res.status).toBe(201)
    const insertCall = query.mock.calls[0]
    const aprobadoArg = insertCall[1][13]
    expect(aprobadoArg).toBe(true)
  })

  it('sets aprobado=false when margen_pct < 57', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...mockCosteo, margen_pct: 40, aprobado: false }] })
    await request(app).post('/').send({
      producto: 'Pan barato', piezas_obj: 50, piezas_reales: 50,
      costo_directo: 200, costo_indirecto: 50, costo_total: 250,
      costo_unitario: 5, precio_venta: 8, margen_pct: 37.5,
    })
    const insertCall = query.mock.calls[0]
    const aprobadoArg = insertCall[1][13]
    expect(aprobadoArg).toBe(false)
  })
})
