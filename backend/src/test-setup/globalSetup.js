import 'dotenv/config'
import { migrarRolTenantScopedYRlsPlanillas } from '../db/rlsSetup.js'
import pool from '../db/client.js'

// Corre una sola vez antes de toda la suite de Vitest (ver vitest.config.js).
//
// Antes, backend/src/db/__tests__/tenantQuery.test.js se armaba su propio
// CREATE ROLE/GRANT en su beforeAll — una copia del SQL real de index.js,
// no la migración real. Eso significaba que un CI corriendo como
// superusuario de Postgres (que puede SET ROLE a cualquier rol sin
// necesitar membresía) nunca iba a notar si el GRANT de membresía real se
// rompía, como pasó en producción el 2026-07-31.
//
// Este setup llama a la misma función que index.js usa al arrancar el
// servidor real — cero SQL duplicado — y, a diferencia de index.js
// (no bloqueante, solo loguea un aviso), acá SÍ dejamos que el error se
// propague: si esta migración falla, toda la suite de CI debe abortar de
// inmediato en vez de seguir corriendo tests que nunca la hubieran
// detectado. Ver .github/workflows/backend-ci.yml — CI usa un rol de
// conexión restringido (no superusuario), así que esto sí ejercita el
// camino real de producción.
export default async function setup() {
  try {
    await migrarRolTenantScopedYRlsPlanillas()
  } finally {
    await pool.end()
  }
}
