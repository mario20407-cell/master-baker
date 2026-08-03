import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Ver src/test-setup/globalSetup.js: corre la migración real del rol
    // app_tenant_scoped (RLS) una sola vez antes de toda la suite, en vez
    // de que cada test file se arme su propia copia del SQL.
    globalSetup: './src/test-setup/globalSetup.js',
  },
})
