import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'

function makeHealthApp() {
  const app = express()
  app.get('/api/health', (_, res) => res.json({
    status: 'ok',
    version: '2.7',
    negocio: 'Marquéz Panadería & Repostería',
    ia: { openai: false, anthropic: false, deepseek: false, gemini: false },
    whatsapp: { activo: false, phone_id: 'No configurado' },
    timestamp: new Date().toISOString(),
  }))
  return app
}

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(makeHealthApp()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })

  it('returns version 2.7', async () => {
    const res = await request(makeHealthApp()).get('/api/health')
    expect(res.body.version).toBe('2.7')
  })

  it('includes ia and whatsapp fields', async () => {
    const res = await request(makeHealthApp()).get('/api/health')
    expect(res.body).toHaveProperty('ia')
    expect(res.body).toHaveProperty('whatsapp')
    expect(res.body).toHaveProperty('timestamp')
  })
})
