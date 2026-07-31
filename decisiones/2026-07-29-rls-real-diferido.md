# Decisión técnica: RLS real por tenant — diferido

**Fecha:** 2026-07-29
**Estado:** SUPERADO — ver adenda 2026-07-31 al final de este documento.
Los dos bloqueantes de primeros principios de más abajo (fail-open,
agotamiento de pool) están resueltos con un diseño distinto al evaluado
originalmente. El resto de este documento se deja intacto como registro
histórico de por qué el diseño original (AsyncLocalStorage) no se
implementó.

## Contexto

Auditoría de seguridad del 2026-07-28/29 identificó que el aislamiento
multi-tenant depende exclusivamente del filtrado explícito por
`tenant_id` en cada consulta del backend — no hay respaldo a nivel de
base de datos, porque el rol de conexión de producción tiene
`BYPASSRLS`. Las políticas RLS definidas en `schema.sql` existen pero
son efectivamente inertes para ese rol.

## Qué se evaluó

Se diseñó una alternativa: usar `AsyncLocalStorage` para propagar el
tenant del request, y envolver cada consulta en una transacción con
`SET LOCAL ROLE app_tenant_scoped` + `SET LOCAL app.tenant_id`, dejando
el rol privilegiado actual intacto para admin/webhook/scripts.

El diseño se sometió a dos revisiones adversariales independientes
(Claude + Antigravity, checklist de 21 puntos, ver
`brief-antigravity-rls.md`). Resultado: **6 bloqueantes, 8 riesgos, 7
OK**. Los dos bloqueantes más sólidos, verificables desde primeros
principios sin depender de zonas grises de infraestructura:

1. **Fail-open por diseño.** Si `AsyncLocalStorage` pierde el contexto
   (callback de librería externa, promesa no esperada, error de
   desarrollo), la consulta cae al rol privilegiado en silencio en vez
   de rechazarse — el defecto opuesto al que se buscaba corregir.
2. **Agotamiento del pool bajo concurrencia.** Envolver cada consulta
   individual en `BEGIN/SET LOCAL/COMMIT` cuadruplica los viajes a la
   base. Rutas con `Promise.all()` o con patrones N+1 ya identificados
   (módulo de nómina) saturarían el pool (`max: 10`) bajo carga modesta.

Un tercer punto (incompatibilidad con el Transaction Pooler de Supabase,
Supavisor) se marcó bloqueante en la primera revisión. Se pidió
explícitamente evidencia (cita textual de documentación de Supabase o
prueba empírica) en una segunda ronda; la respuesta bajó el veredicto a
RIESGO con una explicación más específica (afinidad de conexión durante
la transacción, descarte de `SET LOCAL` antes de que la conexión vuelva
al pool) pero **sin cita ni enlace verificable**, pese a dos búsquedas
web reportadas. Queda registrado como riesgo probable pero no confirmado
documentalmente. No se persiguió una tercera ronda porque los otros dos
bloqueantes (fail-open de `AsyncLocalStorage`, agotamiento del pool por
concurrencia) ya bastan por sí solos para sostener la decisión.

## Decisión

**No se implementa RLS real por ahora.** Se acepta el riesgo actual:

- El aislamiento sigue dependiendo 100% del filtrado explícito por
  `tenant_id` en el código del backend.
- Ese filtrado está auditado (dos auditorías, 2026-07-28 y 2026-07-29)
  sin violaciones encontradas.
- El riesgo real es a futuro: una ruta nueva, escrita con prisa, que se
  olvide el `WHERE tenant_id`, no tendría ninguna barrera de la base de
  datos que lo detenga.

## Segunda ronda de revisión (paranoia reforzada)

Se le pidió a Antigravity una pasada adicional, más agresiva, sobre
vulnerabilidades a nivel de motor de base de datos. Encontró 3 puntos
nuevos más el ya cerrado de Supavisor:

- **RLS no se activa por defecto en tablas nuevas** (RIESGO, confirmado
  correcto) — cualquier migración futura necesitaría recordar
  `ENABLE ROW LEVEL SECURITY` explícitamente por tabla. Riesgo operativo
  real si algún día se retoma este trabajo, independiente del diseño
  específico evaluado.
- **Vistas se saltan RLS por defecto** y **triggers `SECURITY DEFINER`
  pueden hacerlo también** (correctos en general, pero **no aplican hoy**
  — se verificó `schema.sql` completo: no hay ninguna `CREATE VIEW` ni
  función/trigger `SECURITY DEFINER` en el proyecto).
- **"Imposibilidad de parametrizar `SET LOCAL`, abre inyección SQL"** —
  **hallazgo técnicamente incorrecto.** Postgres tiene
  `set_config('app.tenant_id', $1, true)`, una función nativa que acepta
  parámetro sin interpolación de strings — es el patrón estándar
  documentado para exactamente este caso. El nombre de rol en
  `SET ROLE` tampoco es dato de usuario, así que no hay superficie de
  inyección ahí tampoco. El costo real (más viajes a la base) ya estaba
  capturado en los bloqueantes 2/5/18 originales.

Ninguno de estos puntos cambia la decisión — ya estaba sostenida por los
dos bloqueantes de primeros principios de la primera ronda. Se deja
registrado que, presionado a "endurecer la paranoia", el revisor sumó
ruido además de señal — a tener en cuenta al evaluar sus próximos
reportes: pedirle que verifique sus propias afirmaciones de "esto es
imposible" antes de aceptarlas.

## Cuándo revisar esto de nuevo

- Si el equipo de desarrollo crece más allá de una persona (más
  superficie para el error humano que este control mitigaría).
- Si el número de tenants crece lo suficiente como para justificar la
  inversión en un rediseño más cuidadoso del acceso a datos (fuera del
  ritmo de una sola sesión de trabajo).
- Si aparece una forma de implementar esto sin los dos problemas
  estructurales identificados (fail-open y costo de conexión), por
  ejemplo evaluando un pool dedicado con el rol restringido por defecto
  en vez de cambio dinámico de rol por query.

## Adenda 2026-07-31 — implementado con un diseño distinto

Se retomó este trabajo (instrucción explícita: foco exclusivo hasta
resolverlo). Antes de escribir código se confirmó empíricamente el punto
que la primera ronda dejó como riesgo sin cita verificable (punto 12 del
checklist, `brief-antigravity-rls.md`): **producción usa el Transaction
Pooler de Supabase (Supavisor), puerto 6543** — confirmado leyendo
`DATABASE_URL` directamente en las variables de Railway.

Esto no invalida el patrón `SET LOCAL` dentro de una transacción real
(`BEGIN ... SET LOCAL ROLE ... COMMIT`) — al contrario, lo confirma como
el único patrón seguro bajo ese pooler, porque una transacción explícita
sí queda fijada a una única conexión física mientras dura. Lo que sí
habría sido un error nuevo (evaluado y descartado antes de implementar
nada) es `SET ROLE` a nivel de sesión fuera de una transacción — bajo
Supavisor en modo transacción, un statement fuera de `BEGIN/COMMIT` puede
aterrizar en una conexión física distinta al siguiente, así que ese
contexto no está garantizado que persista ni que no quede pegado en una
conexión que el pooler reutiliza para otro cliente.

**Cómo se resolvieron los dos bloqueantes originales:**

1. **Fail-open de `AsyncLocalStorage` → eliminado, no mitigado.** El
   diseño nuevo no usa `AsyncLocalStorage` en absoluto. `req.tenantId` ya
   es un campo explícito en el objeto `req` de Express, seteado por
   `tenantMiddleware` y sobreescrito por `requireAuth` con el tenant del
   JWT — no hay contexto ambiental que se pueda perder en un límite async,
   porque no hay contexto ambiental: es un parámetro explícito que cada
   caller pasa a mano. `tenantQuery(tenantId, sql, params)` en
   `backend/src/db/client.js` lanza de inmediato si `tenantId` es falsy,
   antes de abrir conexión — fail-closed por construcción, no por
   disciplina de código.

2. **Agotamiento del pool → evitado envolviendo el ámbito correcto, no
   cada query suelta.** `transaction(fn, { tenantId })` extiende el
   helper `transaction()` que ya existía (usado en todas las escrituras
   de varios pasos) para inyectar `SET LOCAL ROLE` + `set_config` una sola
   vez, justo después de su propio `BEGIN` — cero viajes extra a la base
   más allá de los que esa transacción ya pagaba por atomicidad.
   `tenantQuery()` cubre las lecturas sueltas con su propia
   mini-transacción (~4 viajes en vez de 1) — el módulo de nómina, que era
   el ejemplo concreto de patrón N+1 citado en la revisión original, ya se
   corrigió en un trabajo aparte (PR C, consolidación de nómina). Los
   `Promise.all()` con varias queries en paralelo que sí existen en el
   código (2-3 lugares, mapeados antes de tocar nada) siguen funcionando
   en paralelo sin cambios: cada `tenantQuery()` toma su propia conexión
   del pool, igual que hoy.

**Qué NO está resuelto todavía — alcance real de esta sesión:**

- Solo `backend/src/routes/catalogo.js` está migrado a `tenantQuery`/
  `transaction(fn, { tenantId })` como piloto real, verificado con tests.
  El resto de rutas (~85 llamadas a `query()` en archivos tenant-scoped)
  sigue en el rol privilegiado — funciona exactamente igual que hoy,
  nada se rompió, pero tampoco tiene el respaldo de RLS todavía.
- El rol `app_tenant_scoped` y sus `GRANT` se crean vía migración no
  bloqueante en `index.js` (mismo patrón que el resto del archivo), pero
  el mecanismo completo está detrás de la variable de entorno
  `RLS_TENANT_ENFORCE` — apagada por defecto. Hay que confirmar en los
  logs de Railway que la migración corrió sin error antes de activarla.
- Los tests de aislamiento (`backend/src/db/__tests__/tenantQuery.test.js`,
  incluye el caso crítico de una query que "olvida" el `WHERE tenant_id`
  y confirma que RLS la bloquea igual) no se pudieron correr en el
  sandbox de desarrollo — no tiene salida de red hacia Supabase, mismo
  límite ya documentado para otros tests de integración de este repo.
  Quedan para verificación en CI/PR.

Rollback: apagar `RLS_TENANT_ENFORCE` en Railway (sin redeploy) revierte
`catalogo.js` exactamente al comportamiento de hoy. El rol y sus políticas
quedan creados pero inertes si se apaga — no hay downtime ni pérdida de
datos posible por ese lado.
