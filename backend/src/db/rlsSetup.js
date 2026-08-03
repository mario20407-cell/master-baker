import { query } from './client.js'

// RLS real por tenant (ver decisiones/2026-07-29-rls-real-diferido.md y
// backend/src/db/client.js). Crea el rol restringido `app_tenant_scoped`
// (sin BYPASSRLS) y le otorga exactamente los privilegios de tabla que
// necesita — nada más. No bloqueante en producción (ver index.js): mientras
// RLS_TENANT_ENFORCE no esté en 'true', ninguna query real usa este rol
// todavía (ver tenantQuery/transaction en db/client.js).
//
// Extraído de index.js (2026-08-01) para que backend/src/test-setup/
// globalSetup.js pueda correr exactamente esta misma migración — no una
// copia — antes de la suite de tests en CI. Antes, tenantQuery.test.js se
// armaba su propio CREATE ROLE/GRANT en su beforeAll, así que un CI que
// rompiera esta migración real (como el incidente de producción del
// 2026-07-31, causado por faltar el GRANT de membresía) nunca lo iba a
// notar — el test nunca ejercitaba este código.
const SQL_ROL_TENANT_SCOPED = `
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_tenant_scoped') THEN
      CREATE ROLE app_tenant_scoped NOLOGIN;
    END IF;
  END $$;
  GRANT USAGE ON SCHEMA public TO app_tenant_scoped;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant_scoped;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tenant_scoped;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tenant_scoped;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_tenant_scoped;
  -- SET LOCAL ROLE (ver db/client.js) solo funciona si el rol de conexión es
  -- miembro de app_tenant_scoped (o superusuario). No asumimos que el rol de
  -- conexión sea superusuario — se le otorga membresía explícita al rol
  -- actual (current_user), sea cual sea su nombre real detrás del pooler de
  -- Supabase. Causa raíz del 500 en catalogo.js del primer intento de
  -- activar RLS_TENANT_ENFORCE (2026-07-31): faltaba exactamente este GRANT.
  DO $$
  BEGIN
    EXECUTE format('GRANT app_tenant_scoped TO %I', current_user);
  END $$;
`

// planilla_detalle no tenía tenant_id propio (solo planilla_id → planillas
// → tenant_id, un JOIN de por medio) — insuficiente para que una política
// RLS `tenant_isolation` la evalúe directo (ver auditoría QA 2026-07-31,
// hallazgo CRÍTICO #1). Se agrega la columna, se rellena desde planillas
// para las filas que ya existan, y recién ahí se activa RLS sobre las dos
// tablas de planilla — en ese orden, para no dejar nunca una fila con
// tenant_id NULL bajo FORCE ROW LEVEL SECURITY (WITH CHECK la rechazaría).
const SQL_RLS_PLANILLAS = `
  ALTER TABLE planilla_detalle ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
  UPDATE planilla_detalle pd SET tenant_id = p.tenant_id
    FROM planillas p WHERE p.id = pd.planilla_id AND pd.tenant_id IS NULL;
  ALTER TABLE planilla_detalle ALTER COLUMN tenant_id SET NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_planilla_detalle_tenant ON planilla_detalle(tenant_id);

  ALTER TABLE planillas ENABLE ROW LEVEL SECURITY;
  ALTER TABLE planillas FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation ON planillas;
  CREATE POLICY tenant_isolation ON planillas
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

  ALTER TABLE planilla_detalle ENABLE ROW LEVEL SECURITY;
  ALTER TABLE planilla_detalle FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation ON planilla_detalle;
  CREATE POLICY tenant_isolation ON planilla_detalle
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
`

// Ambas migraciones corren siempre en este orden secuencial (nunca en
// paralelo) — dos DDL pesados corriendo al mismo tiempo contra la misma
// base causaron un deadlock real en el primer deploy que los tuvo juntos
// (ver Deploy Logs, 2026-07-31 23:50:49 CST, y ERRORES-CONOCIDOS.md).
//
// A diferencia del uso no bloqueante en index.js (que atrapa el error acá
// mismo, dentro del try/catch de cada paso, para no tumbar el arranque del
// servidor), esta función SÍ propaga el error hacia quien la llama —
// index.js decide qué hacer con eso (solo loguea un aviso), pero
// backend/src/test-setup/globalSetup.js lo deja explotar a propósito: si
// esta migración se rompe, la suite entera de CI debe fallar de inmediato,
// no seguir corriendo tests que nunca la hubieran detectado.
export async function migrarRolTenantScopedYRlsPlanillas() {
  const errores = []

  try {
    await query(SQL_ROL_TENANT_SCOPED)
    console.log('   Esquema:     Rol app_tenant_scoped (RLS real) verificado')
  } catch (err) {
    errores.push(`rol app_tenant_scoped: ${err.message}`)
  }

  try {
    await query(SQL_RLS_PLANILLAS)
    console.log('   Esquema:     tenant_id + RLS en planillas/planilla_detalle verificados')
  } catch (err) {
    errores.push(`RLS de planillas/planilla_detalle: ${err.message}`)
  }

  if (errores.length > 0) {
    throw new Error(errores.join(' | '))
  }
}
