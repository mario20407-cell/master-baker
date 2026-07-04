import { vi, describe, it, expect } from 'vitest'
import request from 'supertest'

// Mock de base de datos con default implementation para evitar retornar undefined
vi.mock('../db/client.js', () => ({
  query: vi.fn(() => Promise.resolve({ rows: [] })),
  transaction: vi.fn(() => Promise.resolve({})),
}))

import { query } from '../db/client.js'
import app from '../index.js'

describe('GET /api/health', () => {
  it('returns 200 with status ok when database is healthy', async () => {
    query.mockResolvedValueOnce({ rows: [[1]] })
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.db_status).toBe('ok')
  })

  it('returns 200 with status ok and db_status error when database throws error', async () => {
    query.mockRejectedValueOnce(new Error('DB connection failed'))
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.db_status).toBe('error')
  })

  it('returns 200 with status ok and db_status timeout when database hangs', async () => {
    // Simular que la consulta a la BD nunca se resuelve
    query.mockImplementationOnce(() => new Promise(() => {}))
    
    const startTime = Date.now()
    const res = await request(app).get('/api/health')
    const duration = Date.now() - startTime

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.db_status).toBe('timeout')
    expect(duration).toBeLessThan(3000) // Asegura respuesta en menos de 3 segundos
  })
})
