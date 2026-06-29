import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { makeApp } from './test-utils.js'

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}))

import { query } from '../db/client.js'
import usuariosRouter from '../routes/usuarios.js'

const app = makeApp(usuariosRouter)

const mockUsuario = {
  id: 'u-1', nombre: 'Ana López', email: 'ana@marquez.com',
  rol: 'operario', activo: true, creado_en: '2024-01-01',
}

describe('GET /api/usuarios', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns usuarios list', async () => {
    query.mockResolvedValueOnce({ rows: [mockUsuario] })
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body[0].nombre).toBe('Ana López')
  })
})

describe('POST /api/usuarios', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates usuario and returns 201', async () => {
    query.mockResolvedValueOnce({ rows: [mockUsuario] })
    const res = await request(app).post('/').send({ nombre: 'Ana López', email: 'ana@marquez.com' })
    expect(res.status).toBe(201)
    expect(res.body.nombre).toBe('Ana López')
  })

  it('defaults rol to operario', async () => {
    query.mockResolvedValueOnce({ rows: [mockUsuario] })
    await request(app).post('/').send({ nombre: 'Ana López', email: 'ana@marquez.com' })
    const params = query.mock.calls[0][1]
    expect(params[3]).toBe('operario')
  })

  it('returns 400 when nombre is missing', async () => {
    const res = await request(app).post('/').send({ email: 'sin@nombre.com' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/nombre/i)
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/').send({ nombre: 'Sin Email' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/email/i)
  })
})

describe('PATCH /api/usuarios/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates usuario and returns updated row', async () => {
    const updated = { ...mockUsuario, activo: false }
    query.mockResolvedValueOnce({ rows: [updated] })
    const res = await request(app).patch('/u-1').send({ activo: false })
    expect(res.status).toBe(200)
    expect(res.body.activo).toBe(false)
  })

  it('returns 404 when usuario not found', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).patch('/no-existe').send({ activo: false })
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/no encontrado/i)
  })
})
