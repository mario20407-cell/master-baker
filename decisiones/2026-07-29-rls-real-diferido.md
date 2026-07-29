# Decisión técnica: RLS real por tenant — diferido

**Fecha:** 2026-07-29
**Estado:** Riesgo aceptado, no implementado.

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
