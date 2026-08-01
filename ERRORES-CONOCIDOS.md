# 📓 Registro de Errores Conocidos y Parches - Master Baker (marquez-app)

Este archivo sirve como memoria histórica de fallos, bugs de regresión y parches aplicados en el sistema Master Baker.
Antes de diagnosticar un error desde cero, revisa si existe un patrón coincidente en esta lista.

---

## 📅 Estructura de Registro

Cada nueva entrada debe seguir esta plantilla:

```text
### [YYYY-MM-DD] - BREVE DESCRIPCIÓN DEL ERROR
- **Síntoma / Mensaje de Error:** Excepción o comportamiento anómalo.
- **Componente Afectado:** (Ej. `backend/mcp/server.py`, `database/rls.sql`, `frontend/Calculadora.tsx`)
- **Causa Raíz:** Por qué ocurrió el fallo.
- **Solución / Fix Aplicado:** Breve explicación del parche y archivo corregido.
- **Instrucciones para Verificar Regresión:** Cómo comprobar si el bug volvió a aparecer.
```

---

## Entradas

### [2026-07-26] - Bot de WhatsApp no respondía a mensajes reales (access_token vencido)
- **Síntoma / Mensaje de Error:** El webhook de WhatsApp recibía los mensajes entrantes con normalidad (POST 200, log `[WhatsApp] Mensaje de <número>: "..."`), pero el bot nunca contestaba. Los logs de Railway mostraban, inmediatamente después de cada mensaje recibido: `[WhatsApp] Error al enviar: { error: { message: 'Authentication Error', code: 190, type: 'OAuthException' } }`.
- **Componente Afectado:** `tenant_whatsapp_config.access_token` (tabla en Supabase/producción); función `enviarMensaje` en `backend/src/routes/whatsapp.js`.
- **Causa Raíz:** El `access_token` guardado para el tenant de Marquéz era un token vencido — se había rotado previamente (task #73) usando el flujo por defecto de Meta, que genera un token de corta duración (temporal, vence en horas/días) en vez de un token de usuario del sistema (System User) de larga duración. Falsa pista inicial: se sospechó que la app de Meta "sin publicar" bloqueaba la entrega de webhooks — descartado con evidencia en logs (los webhooks, tanto reales como el de prueba de Meta, sí llegaban sin problema; el fallo era exclusivamente al enviar la respuesta).
- **Solución / Fix Aplicado:** Se generó un token nuevo desde Meta Business Settings → Usuarios del sistema, usando el usuario de sistema ya existente (`Mario_Leiva`) con los 4 permisos necesarios (`manage_app_solution`, `whatsapp_business_manage_events`, `whatsapp_business_management`, `whatsapp_business_messaging`) y caducidad **"Nunca"**. Se actualizó `tenant_whatsapp_config.access_token` en producción vía script puntual (no commiteado, token pasado solo por variable de entorno, script borrado después de usar) — mismo patrón que `migrar_whatsapp_marquez.js`.
- **Instrucciones para Verificar Regresión:** Mandar un mensaje real por WhatsApp al número de Marquéz y confirmar dos cosas: (1) en el chat de WhatsApp llega una respuesta del bot; (2) en los logs de Railway (`Deploy Logs` del servicio `master-baker`) aparece `[WhatsApp] Respuesta enviada a <número>` sin ningún `[WhatsApp] Error al enviar` ni `OAuthException` inmediatamente después del mensaje recibido. Si vuelve a aparecer `code: 190, type: 'OAuthException'`, el token se revocó o venció — confirmar primero en Meta Business Settings → Usuarios del sistema → Marquez-bot que el token siga activo antes de generar uno nuevo.

### [2026-07-31] - Catálogo caído (500) al activar RLS_TENANT_ENFORCE — faltaba GRANT de membresía del rol
- **Síntoma / Mensaje de Error:** Al activar `RLS_TENANT_ENFORCE=true` en Railway, `GET /api/catalogo` (y cualquier ruta migrada a `tenantQuery`/`transaction(fn,{tenantId})`) empezó a responder 500 de forma consistente. En el frontend se veía como "Sin productos en esta categoría" (catálogo vacío, sin error visible). Railway Deploy Logs mostraba `GET /api/catalogo 500` repetido en cada intento.
- **Componente Afectado:** `backend/src/db/client.js` (`aplicarContextoTenant`, usada por `tenantQuery` y `transaction(fn,{tenantId})`); migración del rol `app_tenant_scoped` en `backend/src/index.js`.
- **Causa Raíz:** `SET LOCAL ROLE app_tenant_scoped` requiere que el rol de conexión (el que usa `DATABASE_URL`) sea miembro del rol `app_tenant_scoped`, o sea superusuario. La migración que crea `app_tenant_scoped` y sus `GRANT` de privilegios de tabla nunca le otorgó esa membresía al rol de conexión — se asumió (sin verificarlo) que el rol de Supabase detrás del pooler era superusuario y podía hacer `SET ROLE` a cualquier rol sin necesidad de membresía explícita. Esa asunción era incorrecta (o al menos no verificable de antemano), y Postgres rechaza el `SET LOCAL ROLE` con "permission denied to set role" — la transacción entera hace `ROLLBACK` y la ruta responde 500. Fail-closed por diseño (no hubo fuga de datos ni corrupción, solo la ruta dejó de funcionar), pero rompió una función real del negocio.
- **Solución / Fix Aplicado:** Se agregó a la migración de `backend/src/index.js`: `EXECUTE format('GRANT app_tenant_scoped TO %I', current_user)` dentro de un bloque `DO $$`, usando `current_user` en vez de hardcodear un nombre de rol — así funciona sin importar cómo se llame el rol real detrás del pooler de Supabase. Mitigación inmediata mientras se diagnosticaba: se apagó `RLS_TENANT_ENFORCE` (borrando la variable en Railway) para restaurar el catálogo, exactamente el kill switch para el que se diseñó esa variable.
- **Instrucciones para Verificar Regresión:** Antes de volver a activar `RLS_TENANT_ENFORCE=true`, confirmar en logs de Railway que corrió `Esquema: Rol app_tenant_scoped (RLS real) verificado` sin warning después del deploy con el fix. Después de activar el flag, entrar a masterbaker.store → Catálogo con un usuario real y confirmar que los productos cargan (no "Sin productos en esta categoría") — y revisar Deploy Logs filtrando por `GET /api/catalogo` para confirmar 200, no 500, en los primeros minutos.
- **Resuelto:** PR #98 (`GRANT app_tenant_scoped TO current_user` dinámico en `index.js`) desplegado 2026-07-31 21:30 CST. Deploy log confirmó `Esquema: Rol app_tenant_scoped (RLS real) verificado` sin warning. `RLS_TENANT_ENFORCE=true` reactivado 21:42 CST — tráfico real verificado: `GET /api/catalogo 304` (no 500), catálogo con los 9 productos reales cargando en masterbaker.store.

### [2026-08-01] - Deadlock entre migraciones no bloqueantes concurrentes al arrancar (rol app_tenant_scoped vs RLS de planillas)
- **Síntoma / Mensaje de Error:** En el deploy de PR #100, Railway Deploy Logs mostró `Esquema: (Aviso) No se pudo verificar rol app_tenant_scoped: deadlock detected` inmediatamente seguido de `Esquema: tenant_id + RLS en planillas/planilla_detalle verificados` — es decir, la migración del rol perdió un deadlock de Postgres y solo corrió su rama de warning, mientras la otra migración sí completó.
- **Componente Afectado:** `backend/src/index.js` — bloques de migración no bloqueante al arrancar el servidor (patrón `query(sql).then(...).catch(...)` sin await, ejecutados en paralelo).
- **Causa Raíz:** Dos promesas independientes, ambas sin `await` (para no bloquear el arranque del servidor), disparaban DDL sobre el catálogo al mismo tiempo: una migración hacía `GRANT`/`ALTER DEFAULT PRIVILEGES` para el rol `app_tenant_scoped`, la otra hacía `ALTER TABLE ... ENABLE/FORCE ROW LEVEL SECURITY` sobre `planillas`/`planilla_detalle`. Al correr en paralelo, Postgres detectó un ciclo de locks de catálogo entre ambas y abortó una de las dos transacciones (deadlock detected). Esa vez fue inocuo porque el rol y sus GRANTs ya existían de deploys anteriores, pero es un riesgo real de regresión en cualquier deploy futuro que agregue una migración DDL nueva al mismo patrón.
- **Solución / Fix Aplicado:** PR #101 — se encadenaron las dos migraciones con `.finally()` en vez de dejarlas correr en paralelo, para que nunca compitan por los mismos locks de catálogo. El resto del comportamiento (no bloqueante para el arranque del servidor) se mantiene igual.
- **Instrucciones para Verificar Regresión:** Después de cualquier deploy que toque migraciones de `backend/src/index.js`, revisar Railway Deploy Logs y confirmar que las líneas `Esquema: Rol app_tenant_scoped (RLS real) verificado` y `Esquema: tenant_id + RLS en planillas/planilla_detalle verificados` aparecen ambas sin el prefijo `(Aviso)` y sin ningún mensaje de `deadlock detected`. Si aparece un nuevo bloque de migración DDL no bloqueante en `index.js`, verificar que esté encadenado (`.then()`/`.finally()`) detrás de las migraciones existentes en vez de dispararse en paralelo.
- **Resuelto:** PR #101 (`e5bf811`) desplegado 2026-08-01 00:25 CST (deploy `6feac377`). Deploy log confirmado limpio: ambas líneas "verificado" aparecen sin warning ni deadlock. Sentry sin issues nuevos sin resolver en la hora posterior al deploy.
