// backend/src/db/__tests__/tenantQuery.test.js
//
// Prueba de aislamiento real de RLS por tenant (ver
// decisiones/2026-07-29-rls-real-diferido.md y db/client.js).
//
// El caso que de verdad importa (checklist punto 10 de
// brief-antigravity-rls.md): una query con un bug real que se "olvida" el
// WHERE tenant_id. Si la base no la bloquea sola, RLS no está protegiendo
// nada — es exactamente el escenario que el filtrado manual en el código
// no puede cubrir cuando alguien comete ese error a futuro.
//
// Requiere una base Postgres real y alcanzable (CI: Postgres efímero, ver
// decisiones/2026-07-29-rls-real-diferido.md; no corre en el sandbox de
// desarrollo, que no tiene salida de red hacia Supabase).
import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { query, tenantQuery, transaction } from '../client.js'

const tenantA = 'aaaaaaaa-1111-1111-1111-111111111111'
const tenantB = 'bbbbbbbb-2222-2222-2222-222222222222'
let productoA, productoB

beforeAll(async () => {
  // Idempotente y a propósito redundante con la migración no bloqueante de
  // index.js — este archivo no debe depender del orden en que vitest
  // importe otros archivos de test para tener el rol listo.
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_tenant_scoped') THEN
        CREATE ROLE app_tenant_scoped NOLOGIN;
      END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO app_tenant_scoped;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant_scoped;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tenant_scoped;
  `)

  await query(
    `INSERT INTO tenants (id, slug, nombre_negocio, pais, moneda, margen_objetivo, activo, plan)
     VALUES ($1, 'test-tenant-rls-a', 'Test RLS A', 'Nicaragua', 'C$', '57.00', true, 'trial'),
            ($2, 'test-tenant-rls-b', 'Test RLS B', 'Nicaragua', 'C$', '57.00', true, 'trial')
     ON CONFLICT (id) DO NOTHING`,
    [tenantA, tenantB]
  )

  const { rows: [pA] } = await query(
    `INSERT INTO productos (tenant_id, nombre, categoria, precio, presentacion, activo)
     VALUES ($1, 'Producto Test RLS A', 'Test', 10, 'unidad', true) RETURNING id`,
    [tenantA]
  )
  productoA = pA.id

  const { rows: [pB] } = await query(
    `INSERT INTO productos (tenant_id, nombre, categoria, precio, presentacion, activo)
     VALUES ($1, 'Producto Test RLS B', 'Test', 20, 'unidad', true) RETURNING id`,
    [tenantB]
  )
  productoB = pB.id
})

afterAll(async () => {
  await query('DELETE FROM productos WHERE tenant_id IN ($1, $2)', [tenantA, tenantB])
  await query('DELETE FROM tenants WHERE id IN ($1, $2)', [tenantA, tenantB])
})

describe('tenantQuery — fail-closed', () => {
  it('rechaza sin abrir conexión si no hay tenantId', async () => {
    await expect(tenantQuery(null, 'SELECT 1')).rejects.toThrow(/tenantId es requerido/)
    await expect(tenantQuery(undefined, 'SELECT 1')).rejects.toThrow(/tenantId es requerido/)
  })
})

describe('tenantQuery — aislamiento real vía RLS (RLS_TENANT_ENFORCE=true)', () => {
  const envPrevio = process.env.RLS_TENANT_ENFORCE

  beforeAll(() => { process.env.RLS_TENANT_ENFORCE = 'true' })
  afterAll(() => { process.env.RLS_TENANT_ENFORCE = envPrevio })

  it('con WHERE tenant_id correcto, cada tenant ve solo lo suyo', async () => {
    const { rows: rowsA } = await tenantQuery(tenantA, 'SELECT * FROM productos WHERE tenant_id = $1', [tenantA])
    const { rows: rowsB } = await tenantQuery(tenantB, 'SELECT * FROM productos WHERE tenant_id = $1', [tenantB])
    expect(rowsA.map(r => r.id)).toContain(productoA)
    expect(rowsA.map(r => r.id)).not.toContain(productoB)
    expect(rowsB.map(r => r.id)).toContain(productoB)
    expect(rowsB.map(r => r.id)).not.toContain(productoA)
  })

  it('CASO CRÍTICO: una query que "olvida" el WHERE tenant_id no debe filtrar entre tenants', async () => {
    // Simula el bug real que el filtrado manual no puede prevenir: se pide
    // el producto de B, pero con el contexto de sesión de A. Si RLS
    // funciona, esto debe devolver 0 filas — no el producto de otro tenant.
    const { rows } = await tenantQuery(tenantA, 'SELECT * FROM productos WHERE id = $1', [productoB])
    expect(rows.length).toBe(0)
  })

  it('CASO CRÍTICO: un SELECT * sin ningún WHERE nunca cruza tenants', async () => {
    const { rows } = await tenantQuery(tenantA, 'SELECT * FROM productos', [])
    expect(rows.every(r => r.tenant_id === tenantA)).toBe(true)
    expect(rows.some(r => r.id === productoB)).toBe(false)
  })

  it('un INSERT con tenant_id de otro tenant es bloqueado por WITH CHECK', async () => {
    // Intento de escribir un registro de B mientras el contexto de sesión
    // es A — la policy WITH CHECK debe rechazarlo (no silenciarlo).
    await expect(
      tenantQuery(
        tenantA,
        `INSERT INTO productos (tenant_id, nombre, categoria, precio, presentacion, activo)
         VALUES ($1, 'Intento cruzado', 'Test', 5, 'unidad', true)`,
        [tenantB]
      )
    ).rejects.toThrow()
  })

  it('SET LOCAL no persiste fuera de su transacción (no contamina la siguiente query)', async () => {
    await tenantQuery(tenantA, 'SELECT 1', [])
    const { rows } = await query(`SELECT current_setting('app.tenant_id', true) AS t`)
    // Después de que la transacción de tenantQuery hace COMMIT, Postgres
    // descarta el SET LOCAL — la siguiente sesión/consulta no debe heredar
    // el tenant_id de A.
    expect(rows[0].t).not.toBe(tenantA)
  })

  it('transaction(fn, { tenantId }) aplica el mismo aislamiento en bloques de varios pasos', async () => {
    const resultado = await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM productos WHERE id = $1', [productoB])
      return rows
    }, { tenantId: tenantA })
    expect(resultado.length).toBe(0)
  })
})

describe('tenantQuery — kill switch (RLS_TENANT_ENFORCE apagado, comportamiento de hoy)', () => {
  const envPrevio = process.env.RLS_TENANT_ENFORCE

  beforeAll(() => { delete process.env.RLS_TENANT_ENFORCE })
  afterAll(() => { process.env.RLS_TENANT_ENFORCE = envPrevio })

  it('sin el flag, tenantQuery se comporta como query() de siempre (rol privilegiado)', async () => {
    // Con el flag apagado, el "bug" de olvidar el WHERE SÍ se filtra entre
    // tenants — es el comportamiento actual documentado en la decisión de
    // 2026-07-29, no una regresión de este archivo. Confirma que el kill
    // switch realmente desactiva el mecanismo nuevo sin tocar código.
    const { rows } = await tenantQuery(tenantA, 'SELECT * FROM productos WHERE id = $1', [productoB])
    expect(rows.length).toBe(1)
    expect(rows[0].id).toBe(productoB)
  })
})
