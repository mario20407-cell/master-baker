import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../index.js'

describe('🔴 SIMULACIÓN DE PRUEBAS DE SEGURIDAD (RED TEAMING)', () => {
  let adminToken
  let operarioToken
  let fakeAdminToken

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-secure'

    adminToken = jwt.sign(
      { usuarioId: 'u-admin', tenantId: 'test-tenant-id', rol: 'admin', email: 'admin@marquez.com', nombre: 'Admin' },
      process.env.JWT_SECRET
    )

    operarioToken = jwt.sign(
      { usuarioId: 'u-operario', tenantId: 'test-tenant-id', rol: 'operario', email: 'op@marquez.com', nombre: 'Operario' },
      process.env.JWT_SECRET
    )

    fakeAdminToken = jwt.sign(
      { usuarioId: 'u-fake', tenantId: 'test-tenant-id', rol: 'admin', email: 'hacker@hacker.com', nombre: 'Hacker' },
      'CLAVE_COMPROMETIDA_DEL_HISTORIAL_DE_GIT_QUE_YA_FUE_ROTADA'
    )
  })

  it('Escenario 1: Intentar registrar un administrador sin autenticación (Debe denegar 401)', async () => {
    const res = await request(app)
      .post('/api/auth/registrar')
      .send({ nombre: 'Atacante', email: 'attacker@root.com', password: 'password123', rol: 'admin' })
    
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/se requiere autenticacion/i)
  })

  it('Escenario 2: Intentar registrar un administrador usando token con rol de "operario" (Debe denegar 403)', async () => {
    const res = await request(app)
      .post('/api/auth/registrar')
      .set('Authorization', `Bearer ${operarioToken}`)
      .send({ nombre: 'Atacante', email: 'attacker@root.com', password: 'password123', rol: 'admin' })
    
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/accion no permitida/i)
  })

  it('Escenario 3: Acceder a ventas de otro tenant alterando header x-tenant-id sin JWT (Debe denegar 401)', async () => {
    const res = await request(app)
      .get('/api/ventas')
      .set('x-tenant-id', 'hacked-tenant-id')
    
    expect(res.status).toBe(401)
  })

  it('Escenario 4: Acceder a conversaciones de WhatsApp de clientes sin token (Debe denegar 401)', async () => {
    const res = await request(app)
      .get('/api/whatsapp/conversacion/50588888888')
    
    expect(res.status).toBe(401)
  })

  it('Escenario 5: Intentar acceder a usuarios usando un secreto de firma JWT antiguo o forjado (Debe denegar 401)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${fakeAdminToken}`)
    
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/token invalido/i)
  })
})
