import { vi, describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}))

import { query } from '../db/client.js'
import { tenantMiddleware, TENANT_MARQUEZ_ID } from '../middleware/tenantMiddleware.js'

function makeApp() {
  const app = express()
  app.use(tenantMiddleware)
  app.get('/test', (req, res) => res.json({ tenantId: req.tenantId }))
  return app
}

describe('tenantMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses x-tenant-id header when present', async () => {
    const res = await request(makeApp())
      .get('/test')
      .set('x-tenant-id', 'custom-uuid-1234')
    expect(res.status).toBe(200)
    expect(res.body.tenantId).toBe('custom-uuid-1234')
  })

  it('falls back to default Marquéz tenant when no header', async () => {
    const res = await request(makeApp()).get('/test')
    expect(res.status).toBe(200)
    expect(res.body.tenantId).toBe(TENANT_MARQUEZ_ID)
  })

  it('resolves tenant by subdomain', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'sub-tenant-99' }] })
    const res = await request(makeApp())
      .get('/test')
      .set('host', 'panaderia.masterbaker.app')
    expect(res.body.tenantId).toBe('sub-tenant-99')
  })

  it('falls back to default when subdomain not found in DB', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp())
      .get('/test')
      .set('host', 'desconocida.masterbaker.app')
    expect(res.body.tenantId).toBe(TENANT_MARQUEZ_ID)
  })
})
