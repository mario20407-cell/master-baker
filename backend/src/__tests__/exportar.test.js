import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { makeApp } from './test-utils.js'

process.env.JWT_SECRET = 'test-secret'

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn((token) => {
      if (token === 'valid-token') {
        return { usuarioId: 'u-1', tenantId: 'jwt-tenant-id', rol: 'admin', email: 'a@a.com', nombre: 'A' }
      }
      const err = new Error('invalid token')
      err.name = 'JsonWebTokenError'
      throw err
    }),
  },
}))

import { query } from '../db/client.js'
import exportarRouter from '../routes/exportar.js'

const app = makeApp(exportarRouter)
const auth = (req) => req.set('Authorization', 'Bearer valid-token')

const ENDPOINTS = ['/catalogo', '/recetas', '/costeos', '/inventario', '/compras', '/reporte']

describe('GET /api/exportar — requiere autenticacion', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(ENDPOINTS)('returns 401 without Authorization header on %s', async (path) => {
    const res = await request(app).get(path)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/exportar — filtra por tenant_id del JWT', () => {
  beforeEach(() => vi.clearAllMocks())

  it('/catalogo scopes query to tenantId from the token', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    const res = await auth(request(app).get('/catalogo'))
    expect(res.status).toBe(200)
    expect(query.mock.calls[0][1]).toEqual(['jwt-tenant-id'])
  })

  it('/recetas scopes query to tenantId from the token', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    await auth(request(app).get('/recetas'))
    expect(query.mock.calls[0][1]).toEqual(['jwt-tenant-id'])
  })

  it('/costeos scopes query to tenantId from the token', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    await auth(request(app).get('/costeos'))
    expect(query.mock.calls[0][1]).toEqual(['jwt-tenant-id'])
  })

  it('/inventario scopes query to tenantId from the token', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    await auth(request(app).get('/inventario'))
    expect(query.mock.calls[0][1]).toEqual(['jwt-tenant-id'])
  })

  it('/compras scopes query to tenantId from the token', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    await auth(request(app).get('/compras'))
    expect(query.mock.calls[0][1]).toEqual(['jwt-tenant-id'])
  })

  it('/reporte scopes both queries to tenantId from the token', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total_productos: 0, total_recetas: 0, total_costeos: 0, costeos_rechazados: 0, margen_promedio: null, utilidad_total: null, insumos_criticos: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await auth(request(app).get('/reporte'))
    expect(res.status).toBe(200)
    expect(query.mock.calls[0][1]).toEqual(['jwt-tenant-id'])
    expect(query.mock.calls[1][1]).toEqual(['jwt-tenant-id'])
  })
})
