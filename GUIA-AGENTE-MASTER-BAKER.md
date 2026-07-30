# Guía de contexto — Master Baker (marquez-app)

Documento de referencia para cualquier agente de IA que vaya a trabajar en este repositorio. Objetivo: que pueda orientarse sin tener que redescubrir todo desde cero. Última actualización: 26 de julio de 2026.

## 1. Qué es Master Baker

Master Baker (nombre interno del repo: `marquez-app`) es un sistema SaaS multi-tenant de gestión para panaderías: costeo de recetas, inventario, producción, nómina/pasivos laborales, y un bot de WhatsApp para que los clientes finales hagan pedidos. Nació como un sistema a medida para una sola panadería (Marquéz Panadería & Repostería, Chichigalpa, Nicaragua) y se está convirtiendo en un producto para varios negocios ("socios fundadores") bajo el mismo código, cada uno aislado como un `tenant`.

Dueño del proyecto: Mario Leiva (`mario20407@gmail.com`). Repo: `https://github.com/mario20407-cell/master-baker` (público).

## 2. Stack técnico

| Capa | Tecnología | Dónde corre |
|---|---|---|
| Frontend | React 18 + Vite + TailwindCSS + PWA | Vercel |
| Backend | Node.js + Express | Railway (`master-baker-production.up.railway.app`) |
| Base de datos | PostgreSQL | Supabase |
| IA | Anthropic Claude, OpenAI GPT-4 mini, DeepSeek, Google Gemini — cada uno para una tarea distinta (lógica de negocio, chat WhatsApp, costeo masivo, lectura de PDFs/imágenes) | APIs externas |
| WhatsApp | Meta WhatsApp Business API (Cloud API) | Meta for Developers |

Dominio de producción: `masterbaker.store`.

## 3. Arquitectura multi-tenant

Todo dato de negocio cuelga de un `tenant_id` que referencia la tabla `tenants` (que tiene un `slug` único, ej. `marquez`). Hoy hay 29 tablas con columna `tenant_id`. El aislamiento entre negocios depende del código de las rutas backend (cada query filtra por `tenant_id`) — no de RLS de Postgres (ver sección 5).

El login es por email + password; el JWT lleva `tenantId` y todas las rutas protegidas usan ese `tenantId` del token, nunca uno que venga del body/query del request.

## 4. Estado funcional (qué ya existe y funciona)

- Costeo de recetas (ingredientes, merma, margen, precio sugerido), inventario, órdenes de producción, lotes.
- Facturación, ventas, panel de reportes.
- Módulo de nómina/pasivos laborales (INSS, aguinaldo, vacaciones, indemnización) con sugerencia automática de costo de mano de obra.
- Bot de WhatsApp multi-tenant: cada negocio tiene su propio número (tabla `tenant_whatsapp_config`), catálogo en vivo desde la base, toma pedidos, agenda, notifica cuando un pedido está listo. IA (GPT-4 mini) atiende la conversación.
- CRM básico de WhatsApp: clientes y pedidos quedan guardados y visibles en el panel.
- Registro de negocio con código de invitación (`/registro`, socios fundadores), con datos demo (producto + receta de ejemplo) para que el nuevo negocio vea el flujo funcionando.
- PWA instalable del panel de fundadores.
- PIN de administrador por tenant (no global).
- Skill de memoria de errores (`ERRORES-CONOCIDOS.md`) — antes de investigar un bug desde cero, revisar ahí si ya se documentó.
- Grafo de conocimiento del código (`graphify-out/`) — para preguntas sobre el código, correr `graphify query "<pregunta>"` antes de grepear todo el repo a mano (instrucción en `CLAUDE.md`).

## 5. Deuda técnica — estado al 29/jul/2026

Auditoría de QA senior el 25/jul + trabajo de los días siguientes + revisión propia hoy (código real, no solo lo que dicen los commits). **Nota sobre el grafo (`graphify-out/`):** está construido desde el commit `31ab86a7` (26/jul) — quedó desactualizado por 3 días de trabajo real. Correr `graphify update .` la próxima vez que un agente con graphify instalado toque este repo.

**Resuelto desde el 26/jul:**
- `security/cifrar-access-token-whatsapp` — hecho, `WHATSAPP_TOKEN_ENCRYPTION_KEY` configurada en Railway y backfill corrido.
- Contraseña de Supabase rotada.
- Backups de Supabase y alertas de Railway confirmados (manual).
- Términos de Servicio y Política de Privacidad — **borrador** redactado (`Master_Baker_Terminos_de_Servicio.docx`, `Master_Baker_Politica_de_Privacidad.docx`), con placeholders `[COMPLETAR]` para razón social/domicilio (empresa aún no incorporada formalmente) y nota explícita de que necesita revisión de abogado matriculado en Nicaragua antes de publicarse.
- PR A (10 fixes de seguridad crítica/alta), PR B (CI corriendo tests en PRs a `main`), PR C (nómina consolidada + guard automático de `tenant_id`), PR de revocación de sesiones (`token_version`) + DB de test en CI — todos mergeados.
- `migration_planes.sql` (tablas `planes`/`uso_ia_mensual`, aplicada en producción el 25/jul) estaba corrida pero sin versionar — ya está en el repo.
- Evaluación completa de RLS real a nivel de Postgres — **decisión explícita de no implementar por ahora**, documentada en `decisiones/2026-07-29-rls-real-diferido.md` (dos bloqueantes estructurales: fail-open de `AsyncLocalStorage`, agotamiento de pool bajo concurrencia). En su lugar se implementó `backend/scripts/guard-tenant-id.mjs`, corriendo en CI, que detecta queries a tablas por-tenant sin filtro `tenant_id` — mitigación de menor costo/riesgo que RLS real para el mismo problema.
- **2 bugs reales de cálculo encontrados hoy probando la app en vivo** (creando una receta nueva y comparando su costo en las 3 pantallas que lo muestran): `calcularCosteoReceta()` (`lib/costeo.js`) no aplicaba `merma_pct` cuando recibía un objeto "shape API" (leía `receta.merma`, que solo existe en el formulario de creación) — afectaba la página Costeo y cualquier lugar que recalcule costos desde `useRecetas()`. Y `Dashboard.jsx` tenía su propio motor de costeo simplificado, sin merma, sin indirectos (gas/luz/mano de obra), sin prorrateo fiscal — el margen del ranking de rentabilidad no coincidía con el resto de la app. Ambos con fix + tests, commiteados (`0b2685b`, `c643709`), **pendientes de push/PR/merge por Code**.

**Hallazgo nuevo, sin resolver (encontrado en la auditoría de hoy):**
- `Reportes.jsx` (`ReporteCosteo`) tiene **el mismo bug que tenía Dashboard.jsx** — una tercera copia del cálculo de costo/margen (con su propia función `convertir()` duplicada), sin merma, sin indirectos, sin fiscal. No se tocó todavía — pendiente de confirmación para aplicar el mismo fix.
- `frontend/src/lib/config.js` — módulo con `calcMargen`/`calcPrecioMinimo`/`margenAprobado` duplicados de `lib/costeo.js`, mismo nombre de función. Verificado que no se importa en ningún lado (código muerto), pero confunde a quien lo encuentre — candidato a borrar en el próximo housekeeping (PR D).
- `npm audit` (frontend): nueva vulnerabilidad **alta** en `react-router-dom@7.18.2` (única versión disponible ahora mismo) — "RSC Mode CSRF Bypass" (GHSA-qwww-vcr4-c8h2), rango afectado 7.12.0–8.2.0, sin versión parcheada publicada todavía. La app usa `BrowserRouter` (modo SPA clásico), no el modo RSC/framework que el aviso describe — probablemente no explotable tal como está desplegada, pero hay que vigilar que salga un parche y no bajar a una versión vieja (reintroduciría las 2 CVEs que se arreglaron en el PR de hoy temprano).
- `npm audit` (backend): sin cambios — `uuid`/`exceljs` (moderado), riesgo aceptado, requeriría downgrade con breaking change.

**Verificado hoy — deploy de PR #84 en producción:** merge a `main` (`b0bf38e`) confirmado en vivo: Vercel (`masterbaker.store`) y Railway `ample-vibrancy/master-baker` (el único con dominio de producción real, `master-baker-production.up.railway.app`, y status success) ambos verdes. De paso se detectaron 2 servicios Railway huérfanos que fallan en cada deploy pero **no tocan el dominio de producción** — quedan en backlog, sin urgencia:
- `artistic-emotion/master-baker` — credenciales de DB rotas (`ECIRCUITBREAKER`, loop de crash-restart), sin dominio custom asignado. Evaluar apagar/borrar.
- `ample-vibrancy/angelic-caring` (staging) — falta la tabla `tenant_whatsapp_config` (migración no corrida ahí). Correr la migración si algún día se usa ese staging.

**Pendiente, no iniciado:**
- Definir modelo de cobro/billing a los socios fundadores — Marketing propuso estructura (Seed/Pro + overage), desarrollo confirmó que `uso_ia_mensual` es la tabla correcta para contarlo, falta implementar la lógica de cobro por exceso en `planMiddleware.js`.
- PR D (housekeeping menor: índices compuestos en `costeos`/`facturas`, batching de INSERTs en `compras.js`) — bajo impacto, sin urgencia.
- Costo de mano de obra por receta (en vez de un costo parejo por pieza para todo el negocio) — evaluado y diferido, útil solo si entra un tenant tipo pastelería con recetas de tiempo muy distinto entre sí.
- Revisión de un abogado real sobre el borrador de Términos de Servicio / Política de Privacidad antes de publicarlos.

## 6. Convención de trabajo con agentes de código

Este proyecto se maneja con un flujo específico entre "quien decide" (Mario, a veces vía un asistente que arma las instrucciones) y "quien ejecuta" (un agente de código con acceso al repo, ej. Code, Antigravity). Si tu rol es el de ejecutor, seguí este patrón:

1. **Recibís un prompt con alcance acotado.** Repo, contexto de por qué, archivos y líneas exactas a tocar, qué NO tocar, cómo verificar, y cómo entregar. Si algo no está especificado, no improvises — preguntá o dejalo como está.
2. **Rama nueva desde `main` actualizado.** Nunca commitear directo a `main` (está protegida, requiere PR).
3. **Un commit por punto lógico**, mensajes descriptivos.
4. **Verificá vos mismo antes de avisar que terminaste** — corré los tests existentes (`npm test` en `backend/`, `npm run build` en `frontend/`), confirmá conteos/nombres contra el código real en vez de asumir lo que dice el prompt (ej.: si el prompt dice "28 tablas" y contás 29, confiá en tu conteo real pero avisá la discrepancia en vez de inventar una entrada duplicada).
5. **Push y pasás el link de comparación (`compare/main...tu-rama`).** No abrís el PR todavía.
6. **Esperás el ok explícito antes de mergear.** Quien revisa hace su propia verificación independiente (diff, greps) antes de aprobar.
7. Migraciones de base de datos contra producción **no las corre el agente de código** — las corre quien tiene acceso real a `DATABASE_URL` de producción, después de confirmar backups.

## 7. Accesos e infraestructura

- **GitHub:** `github.com/mario20407-cell/master-baker` — repo público. Protecciones de rama en `main` (requiere PR).
- **Railway:** hosting del backend, variables de entorno de producción (`DATABASE_URL`, `JWT_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, claves de IA, etc.). Los deploys son automáticos al mergear a `main`.
- **Vercel:** hosting del frontend.
- **Supabase:** Postgres de producción.
- **Meta for Developers:** configuración de la app de WhatsApp Business (`Marquez-bot`), webhooks, número de teléfono.

## 8. Reglas de seguridad para cualquier agente

- Nunca commitear secretos (tokens, claves, contraseñas) al repo, ni en código ni en archivos de ejemplo con valores reales.
- Si encontrás un secreto expuesto en el historial de git, no lo repitas en tu respuesta ni lo loguees — avisá y proponé rotarlo.
- No corras migraciones destructivas ni `ALTER TABLE` contra producción sin confirmación explícita y sin verificar que hay backup reciente.
- Cualquier cambio en `usuarios`, autenticación, o permisos por tenant necesita doble verificación — es la superficie más sensible del sistema (aislamiento entre negocios).
