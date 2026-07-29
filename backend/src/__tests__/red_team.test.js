import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../index.js'
import { query } from '../db/client.js'

const testTenantId    = '99999999-9999-9999-9999-999999999999'
const testAdminId     = '11111111-1111-1111-1111-111111111111'
const testOperarioId  = '22222222-2222-2222-2222-222222222222'

describe('🔴 SIMULACIÓN DE PRUEBAS DE SEGURIDAD (RED TEAMING)', () => {
  let adminToken
  let operarioToken
  let fakeAdminToken

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-secure'

    // requireAuth ahora valida token_version contra la DB (revocación de
    // sesiones, ver authMiddleware.js) — necesita usuarios reales, no solo
    // un JWT bien firmado. Se crea el tenant y los dos usuarios de prueba.
    await query(
      `INSERT INTO tenants (id, slug, nombre_negocio) VALUES ($1, 'test-red-team', 'Test Red Team')
       ON CONFLICT (id) DO NOTHING`,
      [testTenantId]
    )
    await query(
      `INSERT INTO usuarios (id, tenant_id, email, nombre, rol, activo)
       VALUES ($1, $2, 'admin@marquez.com', 'Admin', 'admin', true)
       ON CONFLICT (id) DO NOTHING`,
      [testAdminId, testTenantId]
    )
    await query(
      `INSERT INTO usuarios (id, tenant_id, email, nombre, rol, activo)
       VALUES ($1, $2, 'op@marquez.com', 'Operario', 'operario', true)
       ON CONFLICT (id) DO NOTHING`,
      [testOperarioId, testTenantId]
    )

    adminToken = jwt.sign(
      { usuarioId: testAdminId, tenantId: testTenantId, rol: 'admin', email: 'admin@marquez.com', nombre: 'Admin' },
      process.env.JWT_SECRET
    )

    operarioToken = jwt.sign(
      { usuarioId: testOperarioId, tenantId: testTenantId, rol: 'operario', email: 'op@marquez.com', nombre: 'Operario' },
      process.env.JWT_SECRET
    )

    fakeAdminToken = jwt.sign(
      { usuarioId: testAdminId, tenantId: testTenantId, rol: 'admin', email: 'hacker@hacker.com', nombre: 'Hacker' },
      'CLAVE_COMPROMETIDA_DEL_HISTORIAL_DE_GIT_QUE_YA_FUE_ROTADA'
    )
  })

  afterAll(async () => {
    await query('DELETE FROM usuarios WHERE tenant_id = $1', [testTenantId])
    await query('DELETE FROM tenants WHERE id = $1', [testTenantId])
  })

  it('Escenario 1: Intentar registrar un administrador sin autenticación (Debe denegar 401)', async () => {
    const res = await request(app)
      .post('/api/auth/registrar')
      .send({ nombre: 'Atacante', email: 'attacker@root.com', password: 'password123', rol: 'admin' })
    
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/se requiere autenticación/i)
  })

  it('Escenario 2: Intentar registrar un administrador usando token con rol de "operario" (Debe denegar 403)', async () => {
    const res = await request(app)
      .post('/api/auth/registrar')
      .set('Authorization', `Bearer ${operarioToken}`)
      .send({ nombre: 'Atacante', email: 'attacker@root.com', password: 'password123', rol: 'admin' })
    
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/acción no permitida/i)
  })

  it('Escenario 3: Acceder a ventas de otro tenant alterando header x-tenant-id sin JWT (Debe denegar 401)', async () => {
    const res = await request(app)
      .get('/api/ventas')
      .set('x-tenant-id', 'hacked-tenant-id')
    
    expect(res.status).toBe(401)
  })

  it('Escenario 4: Acceder a conversaciones de WhatsApp de clientes sin token (Debe denegar 401)', async () => {
    // La ruta era /api/whatsapp/conversacion/:numero; hoy es
    // /api/whatsapp/clientes/:telefono/mensajes (ver routes/whatsapp.js,
    // privateRouter.get('/clientes/:telefono/mensajes', ...)). Este test
    // seguía apuntando a la ruta vieja — nunca se notó porque el CI no
    // corría npm test hasta este PR.
    const res = await request(app)
      .get('/api/whatsapp/clientes/50588888888/mensajes')

    expect(res.status).toBe(401)
  })

  it('Escenario 5: Intentar acceder a usuarios usando un secreto de firma JWT antiguo o forjado (Debe denegar 401)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${fakeAdminToken}`)
    
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/token inválido/i)
  })
})
