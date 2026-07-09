# Ambiente de Staging (Railway)

Fase 0 de la migración de los módulos de Inventario y Recetas: staging quedó
provisionado y sincronizado con un snapshot de producción. Este documento
resume cómo está armado y cómo operarlo.

## Topología

- **Proyecto Railway**: `ample-vibrancy` (el nombre visible en el dashboard no
  es "master-baker" — ojo con esto al buscarlo).
- **Servicio de la app**: `master-baker`, presente en ambos ambientes.
- **Ambiente `production`**:
  - Dominio: `master-baker-production.up.railway.app`
  - Base de datos: **Supabase** externo (`aws-1-us-west-2.pooler.supabase.com`),
    no un plugin Postgres de Railway.
  - Auto-deploy en cada push a `main` del repo `mario20407-cell/master-baker`.
- **Ambiente `staging`** (nuevo):
  - Servicio `Postgres` propio (plugin de Railway), independiente de Supabase.
  - Host interno: `postgres.railway.internal` (solo accesible desde dentro de
    Railway, ej. desde el propio servicio `master-baker`).
  - Host público: variable `DATABASE_PUBLIC_URL` en el servicio `Postgres` —
    úsalo para conectarte desde tu máquina (`pg_restore`, `psql`, etc.).

## Variables de entorno en `staging` → `master-baker`

| Variable | Origen |
|---|---|
| `NODE_ENV`, `PGSSLMODE`, `NODE_TLS_REJECT_UNAUTHORIZED`, `PORT`, `TEST_VAR` | Copiadas tal cual desde `production` (no sensibles) |
| `JWT_SECRET` | Generado nuevo para staging (`openssl rand -hex 32`) — **no** es el mismo secret que producción |
| `DATABASE_URL` | Referencia `${{Postgres.DATABASE_URL}}` al Postgres de staging (resuelta internamente por Railway) |

**Deliberadamente NO copiadas** (son credenciales reales de servicios externos,
no deben usarse desde un ambiente de pruebas):
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `WHATSAPP_TOKEN`,
`WA_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET`.

Si necesitas probar integraciones de IA/WhatsApp en staging, usa credenciales
de sandbox/test propias — nunca las de producción.

`FRONTEND_URL` tampoco se copió; configúralo cuando exista un dominio/deploy
de frontend para staging.

## Backup y restore (cómo se hizo, para repetirlo)

Requiere el cliente de Postgres (`pg_dump`/`pg_restore`/`psql`). Si no lo
tienes instalado, se puede usar el ZIP portátil de binarios de EDB sin
permisos de administrador:
https://www.enterprisedb.com/download-postgresql-binaries

### 1. Backup de producción

```bash
railway run --environment production --service master-baker -- \
  bash -c 'pg_dump "$DATABASE_URL" -F c -f backup_master_baker_$(date +%Y%m%d_%H%M).dump'
```

`railway run` sin un shell de por medio **no expande** `$DATABASE_URL`
(ejecuta el binario directo, sin shell) — por eso el `bash -c` envolviendo el
comando es necesario. La variable nunca se imprime en consola.

Guarda el `.dump` **fuera del repo git** (hay reglas en `.gitignore` para
`*.dump` y `backups/` como salvaguarda adicional, pero no dependas solo de
eso).

### 2. Restore en staging

El servicio `master-baker` en staging solo ve el host interno
(`postgres.railway.internal`), que no es alcanzable desde tu máquina local.
Para restaurar desde tu máquina, apunta al servicio `Postgres` directamente y
usa su `DATABASE_PUBLIC_URL`:

```bash
railway run --environment staging --service Postgres -- \
  bash -c 'pg_restore -d "$DATABASE_PUBLIC_URL" --clean --if-exists --no-owner --no-privileges backup_master_baker_XXXXXXXX.dump'
```

**Errores esperados y a ignorar**: como producción vive en Supabase, el dump
incluye objetos específicos de Supabase que no existen en un Postgres vanilla
de Railway:

- `CREATE EXTENSION supabase_vault ...`
- `COPY vault.secrets ...`
- Políticas RLS que referencian los roles `authenticated` / `service_role`

`pg_restore` reporta estos como errores pero continúa con el resto — no
afectan las tablas de datos de la aplicación. Verifica igual con el paso 3.

### 3. Verificación de datos

```bash
# producción
railway run --environment production --service master-baker -- \
  bash -c 'psql "$DATABASE_URL" -t -c "SELECT (SELECT count(*) FROM inventario), (SELECT count(*) FROM recetas);"'

# staging
railway run --environment staging --service Postgres -- \
  bash -c 'psql "$DATABASE_PUBLIC_URL" -t -c "SELECT (SELECT count(*) FROM inventario), (SELECT count(*) FROM recetas);"'
```

Los conteos deben coincidir. Última verificación (2026-07-09): `inventario`
16 filas, `recetas` 2 filas en ambos ambientes.

## Reglas de seguridad para trabajar con staging

- **Nunca** imprimas `DATABASE_URL`, `DATABASE_PUBLIC_URL` ni ningún secret en
  logs o consola compartida — inyéctalos siempre vía `railway run` o
  variables de entorno.
- **Nunca** copies las credenciales reales de IA/WhatsApp a staging.
- El `DATABASE_PUBLIC_URL` del Postgres de staging es un endpoint público
  protegido solo por la contraseña embebida en la propia URL — trátalo con el
  mismo cuidado que cualquier credencial, aunque el riesgo es menor por ser
  datos de prueba.
- Los pasos de este documento nunca deben apuntar `--environment production`
  salvo para **leer** (backup/verificación). Cualquier `pg_restore`,
  `UPDATE` o `DELETE` masivo va siempre contra `staging`.
