import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../index.js'

// requireAuth ahora consulta la DB (token_version, ver authMiddleware.js) antes
// de dejar pasar cualquier request autenticado, además de la query "de negocio"
// de cada ruta. Este helper hace que la simulación de la tabla usuarios siempre
// devuelva un usuario activo con token_version=0 — coincide con los tokens de
// este archivo, que nunca declaran tokenVersion (undefined → 0 por defecto en
// requireAuth) — y deja que cualquier otra query siga devolviendo lo que cada
// test configure explícitamente.
function mockQueryConAuth(resolverNegocio) {
  query.mockImplementation((sql, params) => {
    if (typeof sql === 'string' && sql.includes('FROM usuarios')) {
      return Promise.resolve({ rows: [{ token_version: 0, activo: true }] })
    }
    return resolverNegocio(sql, params)
  })
}

vi.mock('../db/client.js', () => {
  const resolver = (sql) => {
    if (typeof sql === 'string' && sql.includes('FROM usuarios')) {
      return Promise.resolve({ rows: [{ token_version: 0, activo: true }] })
    }
    return Promise.resolve({ rows: [] })
  }
  return {
    query: vi.fn(resolver),
    // tenantQuery: usada por catalogo.js/recetas.js para RLS real (ver
    // decisiones/2026-07-29-rls-real-diferido.md) — mismo resolver, ignora
    // tenantId. Sin esto, cualquier fuzzing futuro contra esas rutas
    // rompería con "tenantQuery is not a function" en vez de probar lo que
    // este archivo realmente quiere probar.
    tenantQuery: vi.fn((tenantId, sql) => resolver(sql)),
    transaction: vi.fn(),
  }
})

import { query } from '../db/client.js'

describe('🔥 PRUEBAS DE SEGURIDAD EXHAUSTIVAS & FUZZING (RED TEAMING AVANZADO)', () => {
  let secureSecret = 'secure-production-key-example'

  beforeAll(() => {
    process.env.JWT_SECRET = secureSecret
  })

  // ==========================================
  // CATEGORÍA 1: ATAQUES Y MANIPULACIÓN DE JWT
  // ==========================================
  describe('🔐 Categoría 1: Integridad y Criptografía de JWT', () => {

    it('Ataque 1.1: JWT con algoritmo "none" (Debe denegar 401)', async () => {
      // Cabecera: {"alg":"none","typ":"JWT"}
      // Payload: {"usuarioId":"usr-1","tenantId":"test-tenant","rol":"admin"}
      // Token sin firma: cabecera_base64 + "." + payload_base64 + "."
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
      const payload = Buffer.from(JSON.stringify({ usuarioId: 'usr-1', tenantId: 'test-tenant', rol: 'admin' })).toString('base64url')
      const tokenNone = `${header}.${payload}.`

      const res = await request(app)
        .get('/api/ventas')
        .set('Authorization', `Bearer ${tokenNone}`)

      expect(res.status).toBe(401)
    })

    it('Ataque 1.2: Firma forjada con una clave de firma vacía (Debe lanzar error al firmar o denegar 401)', async () => {
      let token = 'invalid-token'
      try {
        token = jwt.sign(
          { usuarioId: 'usr-1', tenantId: 'test-tenant', rol: 'admin' },
          '' // Secreto vacío
        )
      } catch (err) {
        // Si jsonwebtoken lanza error al firmar, el ataque es mitigado inmediatamente
        expect(err.message).toMatch(/must have a value/i)
        return
      }

      const res = await request(app)
        .get('/api/ventas')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(401)
    })
  })

  // ==========================================
  // CATEGORÍA 2: INYECCIÓN SQL (SQLi)
  // ==========================================
  describe('💉 Categoría 2: Inyecciones SQL (SQLi)', () => {

    // NOTA: el filtro de texto libre `producto` fue removido de GET /api/ventas
    // en una reescritura posterior (backend/src/routes/ventas.js hoy solo acepta
    // fecha/canal/metodo_pago/limit, todos de coincidencia exacta). El único
    // equivalente vivo de un filtro ILIKE por texto libre es `producto` en
    // GET /api/lotes (backend/src/routes/lotes.js:12,25) — se apunta ahí.

    it('Ataque 2.1: Inyección SQL clásica en filtros de texto (Debe ser tratada como valor literal)', async () => {
      mockQueryConAuth(() => Promise.resolve({ rows: [] }))

      const res = await request(app)
        .get("/api/lotes?producto=' OR '1'='1")
        .set('Authorization', `Bearer ${jwt.sign({ usuarioId: 'u', tenantId: 't', rol: 'admin' }, secureSecret)}`)

      // El estatus debe ser 200 pero la query debe estar parametrizada
      expect(res.status).toBe(200)
      const lastQuery = query.mock.calls[query.mock.calls.length - 1]
      expect(lastQuery[0]).toMatch(/\$2/) // La query debe usar marcadores posicionales
      expect(lastQuery[1]).toContain("%' OR '1'='1%") // Debe contener el string sanitizado/escapado como parámetro literal
    })

    it('Ataque 2.2: Intentos de escape SQL de mutaciones destructivas (Debe sanitizarse)', async () => {
      mockQueryConAuth(() => Promise.resolve({ rows: [] }))

      const maliciousName = "Dona'; DROP TABLE productos;--"
      const res = await request(app)
        .get(`/api/lotes?producto=${encodeURIComponent(maliciousName)}`)
        .set('Authorization', `Bearer ${jwt.sign({ usuarioId: 'u', tenantId: 't', rol: 'admin' }, secureSecret)}`)

      expect(res.status).toBe(200)
      const lastQuery = query.mock.calls[query.mock.calls.length - 1]
      // Validamos que se pasa como un argumento literal sanitizado en lugar de concatenación directa
      expect(lastQuery[1]).toContain(`%${maliciousName}%`)
    })
  })

  // ==========================================
  // CATEGORÍA 3: CONTROL DE ACCESO (IDOR / BOLA / TENANT BYPASS)
  // ==========================================
  describe('🚧 Categoría 3: Parameter Pollution y Tenant Spoofing', () => {

    it('Ataque 3.1: Enviar múltiples parámetros x-tenant-id para contaminar la query (Bypass de Tenant)', async () => {
      // Simula enviar múltiples headers o query strings duplicados
      const userToken = jwt.sign(
        { usuarioId: 'usr-normal', tenantId: 'tenant-legitimo', rol: 'operario' },
        secureSecret
      )

      mockQueryConAuth(() => Promise.resolve({ rows: [] }))

      const res = await request(app)
        .get('/api/ventas?tenant_id=tenant-malicioso-1&tenant_id=tenant-malicioso-2')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      const paramsUsed = query.mock.calls[query.mock.calls.length - 1][1]
      // El tenantId del token JWT debe prevalecer SIEMPRE sobre cualquier parámetro inyectado
      expect(paramsUsed[0]).toBe('tenant-legitimo')
      expect(paramsUsed[0]).not.toBe('tenant-malicioso-1')
      expect(paramsUsed[0]).not.toBe('tenant-malicioso-2')
    })

    it('Ataque 3.2: Explotar inyección de tipos en query params (Ej: Objetos/Arreglos para engañar a la BD)', async () => {
      const userToken = jwt.sign(
        { usuarioId: 'usr-normal', tenantId: 'tenant-legitimo', rol: 'operario' },
        secureSecret
      )

      mockQueryConAuth(() => Promise.resolve({ rows: [] }))

      // Enviar objetos anidados en el querystring
      const res = await request(app)
        .get('/api/ventas?fecha[$ne]=null')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      const [sql, params] = query.mock.calls[query.mock.calls.length - 1]
      
      // Comprobar que el tenantId sigue asegurado
      expect(params[0]).toBe('tenant-legitimo')
    })
  })
})
