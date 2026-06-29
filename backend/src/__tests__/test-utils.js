import express from 'express'

export function makeApp(router, tenantId = 'test-tenant-id') {
  const app = express()
  app.use(express.json())
  app.use((req, _, next) => { req.tenantId = tenantId; next() })
  app.use('/', router)
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }))
  return app
}
