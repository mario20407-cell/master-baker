import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { makeApp } from './test-utils.js'

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}))

import { query } from '../db/client.js'
import fiscalRouter from '../routes/fiscal.js'

const app = makeApp(fiscalRouter)

const mockConfig = {
  tenant_id: 'test-tenant-id',
  regimen: 'cuota_fija',
  cuota_fija: 500,
  ir_anual: 0,
  iva_aplica: 'Ninguno',
  produccion_mensual: 3000,
  nombre_negocio: 'Marquéz',
  ruc: '',
  configurado: true,
}

describe('GET /api/fiscal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns config when exists', async () => {
    query.mockResolvedValueOnce({ rows: [mockConfig] })
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body.regimen).toBe('cuota_fija')
  })

  it('returns { configurado: false } when no config', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ configurado: false })
  })
})

describe('PUT /api/fiscal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when regimen is invalid', async () => {
    const res = await request(app).put('/').send({ regimen: 'invalido', produccion_mensual: 100 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/regimen/i)
  })

  it('returns 400 when cuota_fija=0 for cuota_fija regimen', async () => {
    const res = await request(app).put('/').send({ regimen: 'cuota_fija', cuota_fija: 0, produccion_mensual: 100 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/cuota_fija/i)
  })

  it('returns 400 when produccion_mensual < 1', async () => {
    const res = await request(app).put('/').send({ regimen: 'reg_general', produccion_mensual: 0 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/produccion_mensual/i)
  })

  it('saves config and returns upserted row', async () => {
    query.mockResolvedValueOnce({ rows: [mockConfig] })
    const res = await request(app).put('/').send({
      regimen: 'cuota_fija', cuota_fija: 500, produccion_mensual: 3000,
    })
    expect(res.status).toBe(200)
    expect(res.body.regimen).toBe('cuota_fija')
  })
})

describe('GET /api/fiscal/prorrateo', () => {
  it('calculates prorrateo_unitario correctly', async () => {
    const res = await request(app).get('/prorrateo?cuota=600&produccion=3000&costo_base=4.5')
    expect(res.status).toBe(200)
    expect(res.body.prorrateo_unitario).toBeCloseTo(0.2, 5)
    expect(res.body.costo_con_fiscal).toBeCloseTo(4.7, 5)
  })

  it('returns zero precio_min when costo_base=0', async () => {
    const res = await request(app).get('/prorrateo?cuota=600&produccion=3000&costo_base=0')
    expect(res.status).toBe(200)
    expect(res.body.precio_min_sin_fiscal).toBe(0)
    expect(res.body.precio_min_con_fiscal).toBeGreaterThan(0)
  })

  it('defaults produccion to 1 to avoid division by zero', async () => {
    const res = await request(app).get('/prorrateo?cuota=600')
    expect(res.status).toBe(200)
    expect(res.body.prorrateo_unitario).toBe(600)
  })
})
