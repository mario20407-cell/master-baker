# Contexto de sesión — Master Baker (para un nuevo agente)

Repo activo: `marquez-app-v2_9/marquez-app` (única copia real — hay copias duplicadas
en el disco, ver sección "Duplicados" abajo, ya movidas a cuarentena).
Remoto: `https://github.com/mario20407-cell/master-baker.git`.
Railway: proyecto `ample-vibrancy` (nombre visible en dashboard, no "master-baker").
Vercel: proyecto `marquez-app-v27`, dominio `masterbaker.store`.

Todo lo de abajo ocurrió en una sola sesión larga, en orden cronológico.

---

## 1. Corrección de precio erróneo en inventario (producción)

- `Esencia de vainilla` tenía `costo_unitario = C$190/ml` en producción — error de
  captura (el precio real era de una presentación de 1 galón a C$420).
- Corregido a `costo_unitario = 0.110952` en `inventario` (producción) y también en
  el snapshot de la receta "Pico de queso" (tabla `ingredientes`), que tenía el
  mismo dato viejo.
- Patrón usado para queries de solo lectura/escritura contra producción:
  `railway run --environment production --service master-baker -- bash -c 'psql "$DATABASE_URL" ...'`
  (o un script node con el paquete `pg`, instalado ad-hoc en el scratchpad).
  **Nunca imprimir `DATABASE_URL` en consola.**

## 2. Bug de `VITE_API_URL` vacío en Vercel → sitio roto en producción

- `masterbaker.store` (Vercel) tenía `VITE_API_URL=""` en el ambiente `production`
  → el frontend caía al fallback `/api` relativo en vez de apuntar a Railway.
- Corregido: `VITE_API_URL=https://master-baker-production.up.railway.app`, y se
  disparó un `vercel --prod` para que el build tomara la variable (las vars
  `VITE_*` se hornean en build time, no runtime).
- Se verificó con Chrome DevTools (vía MCP) que las requests reales llegaban a
  Railway y no a rutas relativas rotas.
- **Hallazgo colateral importante**: el repo tenía una carpeta **duplicada y
  anidada** (`marquez-app-v2_9/marquez-app/marquez-app/frontend`), y **Vercel
  construía desde esa copia anidada**, no desde `frontend/` en la raíz del repo —
  por eso el fix de `/api` (que ya existía en la copia correcta) nunca se
  reflejaba en producción. Railway, en cambio, sí construía desde la copia
  correcta (`backend/` en la raíz).

## 3. Limpieza de la carpeta duplicada dentro del repo

- Se confirmó (vía `git ls-files`, timestamps, `git log`) que
  `marquez-app-v2_9/marquez-app/marquez-app/` era una duplicación accidental
  dentro del mismo repo git (no un submódulo — solo hay un `.git`, en
  `marquez-app-v2_9/marquez-app/.git`).
- Se armó una rama `limpieza/eliminar-duplicado-v27`, se hizo `git rm -r` de la
  carpeta duplicada, commit, y **antes de mergear** se verificó el Root Directory
  de los 4 proyectos Vercel del workspace (`marquez-app-v27`, `marquez-app`,
  `master-baker`, `marquez-panaderia`) para confirmar que ninguno seguía
  apuntando a la ruta que se iba a borrar. Uno sí apuntaba mal
  (`marquez-app` → `marquez-app/frontend`) y se corrigió a `frontend` antes del
  merge. Ya mergeado a `main` y pusheado.

## 4. Branch protection activado en GitHub

- `main` ahora requiere PR para mergear (sin aprobación de terceros, ya que se
  trabaja solo) y exige que la rama esté actualizada antes de mergear.
- **De aquí en adelante, todo el trabajo se hace en ramas nuevas — nunca commits
  directos a `main`.**
- `gh` (GitHub CLI) **no está instalado** en este entorno — los PRs se crean
  manualmente desde el link que da `git push` (`.../pull/new/<rama>`), o
  instalando `gh` si se pide explícitamente.

## 5. Duplicados fuera del repo, movidos a cuarentena (no borrados)

Se identificaron 7 copias más del proyecto regadas en el disco
(`Downloads/`, `~/marquez-app`, `Master Baker V2.4/V2.5/V2.6/V2.7/marquez-app`,
`marquez-app-v3_0` + su `.zip`). Ninguna tenía código único que no estuviera ya
en la copia activa. Se movieron todas (sin borrar) a:
`C:\Users\mario\proyectos\Master Baker\DUPLICADOS_A_REVISAR\`
Pendiente: decidir si se eliminan definitivamente.

## 6. Tests de frontend — motor de costeo (`feature/tests-costeo`, PR #1 ya mergeado)

- `frontend/src/lib/costeo.js` ya tenía tests (`__tests__/costeo.test.js`,
  vitest) de antes. Se extendió `calcularCosteoReceta` con dos parámetros nuevos,
  con defaults que preservan compatibilidad:
  - `costoIndirectoGlobal` (default 0): se suma al indirecto de ingredientes, sin
    duplicar.
  - `margenObjetivo` (default 57): reemplaza la constante hardcodeada
    `MARGEN_OBJETIVO` para `precioMinimo`/`aprobado` (también en los campos
    fiscales, `precioMinimoFiscal`/`aprobadoFiscal`, que tenían la misma
    inconsistencia).
  - 78/78 tests pasan (tests nuevos incluidos).
- Se detectó y corrigió que `Recetas.jsx` tenía **su propia reimplementación
  inline** del cálculo de costeo (duplicada respecto a `lib/costeo.js`, usada por
  `Costeo.jsx`/`useRecetas.js`), con una diferencia real:
  `Recetas.jsx` sí sumaba `costoIndirectoGlobal` (gas/luz/mano de
  `configuracion_costeo`), `calcularCosteoReceta` no. **Hoy no afecta números
  reales** porque `costo_indirecto_gas/luz/mano` están en 0 en los 4 tenants de
  producción — pero es un bug latente en cuanto alguien configure esos campos.
- Se verificó con un script aislado (no commiteado) que conectar `Recetas.jsx` a
  `calcularCosteoReceta` (con los `ings` tal cual, **sin agregar
  `unidad_inventario`**) no causa doble conversión de unidades — es seguro
  porque el precio ya viene pre-convertido por `convertirPrecio()` en el propio
  formulario.
- `Recetas.jsx` refactorizado para usar `calcularCosteoReceta` en vez del bloque
  inline. Verificado con: (a) script contra producción comparando ambos cálculos
  en las 2 recetas reales existentes (0 diferencias), (b) prueba manual en
  **staging** (crear/editar "Dona azucarada", números coincidieron exactamente,
  guardado exitoso).
- **PR #1 ya mergeado a `main`.**

## 7. Tests de backend — validación "costo cero intencional" (`feature/tests-backend`, PR ya mergeado)

- La validación en `backend/src/routes/recetas.js` (POST líneas ~110-118, PUT
  líneas ~194-202) corre **antes** de cualquier query a la DB — 100% síncrona
  sobre `req.body`.
- `requireAuth`/`tenantMiddleware` tampoco tocan la DB si se manda header
  `x-tenant-id` o no hay subdominio — permitió testear sin DB real.
- Se instaló `vitest` + `supertest` como devDeps de backend (antes no había
  ningún framework de testing ahí).
- Test en `backend/src/routes/__tests__/recetas.costo-cero.test.js`: monta un
  Express mínimo con solo el router de recetas (**no importa `index.js`
  directamente**, para evitar su side-effect de `app.listen()` + query de
  arranque contra la DB real al importar el módulo). Mockea `db/client.js`
  (`query`/`transaction`) con `vi.mock`. Genera JWT de prueba con
  `jsonwebtoken` fijando `process.env.JWT_SECRET = 'test-secret'`.
- 9/9 tests pasan: 422 con mensaje exacto, 422 sin el flag, no-422 con flag
  true, no-422 sin ceros, 401 sin JWT — para POST y PUT.
- **PR ya mergeado a `main`.**

## 8. Diagnóstico de producto: "plan de producción" y flujo producción→vitrina→venta

- No existe hoy ningún plan de producción proyectivo (qué producir mañana según
  pedidos). Lo que existe es registro reactivo:
  - `ordenes_produccion` + `Produccion.jsx`: registra una producción YA hecha,
    descuenta inventario de materia prima en tiempo real (ingredientes
    `tipo='directo'` de la receta), con endpoint de verificación previa
    (`GET /produccion/verificar`).
  - `lotes` + `caja_produccion` + `CajaProduccion.jsx`: hornada con costo/precio
    manual, venta/merma agregada por día. **No toca `inventario` de materia
    prima en absoluto.**
  - `sucursales` + `inventario_terminado` + `lote_distribuciones` +
    `InventarioTerminado.jsx`: **ya existe** reparto de un lote entre sucursales
    (`POST /inventario-terminado/distribuir`) que además incrementa stock de
    producto terminado por sucursal (con `stock_minimo` para alertas). Esto es,
    en efecto, el "vitrina" del flujo que se quiere diseñar.
  - `ventas` ya tiene `sucursal_id`.
- **Modelo multi-sucursal ya existe y está en uso real** (4 sucursales reales en
  staging bajo el mismo tenant) — no es una suposición a validar para el diseño
  nuevo.
- **Falta real**: no hay ningún trigger/lógica que dispare o sugiera producción
  cuando `inventario_terminado.stock` cae bajo `stock_minimo` — ese es el hueco
  real, no el resto del pipeline (que ya existe).
- **Riesgo detectado (no doble descuento de inventario, pero sí doble
  contabilización)**: se encontró evidencia real en producción de que la misma
  hornada física se registra en `ordenes_produccion` (que sí descuenta materia
  prima) y **también** en `lotes` (costo manual) segundos/minutos después, varias
  veces. No hay FK entre ambas tablas. `lotes` no descuenta inventario, así que
  no hay doble descuento de materia prima, pero sí doble registro de costo de la
  misma producción, con dos números potencialmente distintos.

## 9. Hotfix EN CURSO — regresión de rutas/permisos/logout (rama `hotfix/restaurar-rutas-perdidas`)

**Hallazgo raíz**: el commit `0404485` ("fix: resolver conflictos merge...", 6 de
julio) **no es un merge real** (un solo padre) — probablemente sobreescribió
`App.jsx`/`Layout.jsx`/`authMiddleware.js`/`auth.js` con una copia vieja
(coincide con el patrón de carpetas duplicadas del punto 3). Se perdió, de un
solo golpe:

- Frontend: rutas y entradas de menú de `CajaProduccion.jsx` (`/lotes`),
  `InventarioTerminado.jsx` (`/sucursales`), `Reportes.jsx` (`/reportes`).
- Frontend: **todo el sistema de permisos por rol** (`RutaPorPermiso` en
  `App.jsx`, `filteredNavGroups` en `Layout.jsx`) — cualquier usuario
  autenticado podía llegar a cualquier ruta, sin importar rol/permisos.
- Frontend: **el botón de "Cerrar sesión" desapareció por completo** — no había
  forma de hacer logout desde la UI.
- Backend: `authMiddleware.js` dejó de setear `req.permisos` en `requireAuth`, y
  `requirePermission` se volvió un no-op (dejaba pasar a cualquiera). `auth.js`
  dejó de firmar/devolver `permisos` en el JWT y en `/auth/me`.
- **La columna `usuarios.permisos` en la DB nunca se perdió** — sigue con datos
  reales (migración `migration_permisos_bitacora.js`, ya aplicada). Confirmado
  contra staging: 4 admins con permisos completos, 1 operario (`sandra`) con
  `['ver_recetas','registrar_ventas','ver_inventario','ver_produccion','ver_catalogo']`.

**Decisión tomada con el dueño del negocio**: el navbar superior actual (no el
sidebar viejo) es el diseño real vigente — no se revierte el archivo completo,
se hace una restauración quirúrgica insertando la lógica vieja dentro de la
estructura actual.

**Bug encontrado y corregido durante el diseño**: la ruta vieja de `/ventas`
usaba `permission="ver_ventas"`, pero el operario real (`sandra`) tiene
`registrar_ventas`, NO `ver_ventas` (son dos permisos distintos e
intencionales, ver `Equipo.jsx` → `PERMISOS_DISPONIBLES`: "Ver Historial de
Ventas" vs. "Registrar Ventas en Caja"). Este era un bug latente **ya presente
en el código pre-regresión** (nunca se notó porque el bug de rutas lo tapó).
Corregido: la ruta `/ventas` (y su entrada de menú) ahora usa
`permission="registrar_ventas"`, no `ver_ventas`, para no quitarle acceso a
sandra respecto a lo que tiene hoy (sin ningún gate).

### Estado exacto de cambios en esta rama (`hotfix/restaurar-rutas-perdidas`), TODAVÍA SIN COMMIT:

- `backend/src/middleware/authMiddleware.js`: `requireAuth` vuelve a setear
  `req.permisos = payload.permisos || []`; `requirePermission` vuelve a
  verificar de verdad (bypass admin, 403 si falta el permiso).
- `backend/src/routes/auth.js`: `generarToken` vuelve a firmar `permisos` en el
  JWT; `POST /login` vuelve a incluir `permisos` en la respuesta; `GET /me`
  vuelve a seleccionar `u.permisos`.
- `frontend/src/App.jsx`: restaurada `RutaPorPermiso`, imports de
  `CajaProduccion`/`InventarioTerminado`/`Reportes`, rutas `lotes` (→
  CajaProduccion), `sucursales` (→ InventarioTerminado), `reportes`, y gates de
  permiso/rol en todas las rutas protegidas (ver el archivo para el mapeo
  exacto). `/ventas` usa `registrar_ventas` (corregido, no `ver_ventas`).
- `frontend/src/components/Layout.jsx`: reescrito completo. Agrega
  `filteredNavGroups` (misma lógica que `RutaPorPermiso`), aplicado a nav
  desktop y drawer móvil. Agrega entradas de menú para las 3 páginas
  restauradas. Agrega **dropdown de usuario** (nombre + rol + "Cerrar sesión")
  al navbar superior, y también un botón de logout en el drawer móvil (que no
  tenía ninguno). Usa `useAuth()` de `AuthContext.jsx` (que nunca cambió, sigue
  exponiendo `{ usuario, login, logout, cargando }` igual que siempre).

### Verificado hasta ahora:
- Backend: `npx vitest run` → 9/9 tests siguen pasando tras los cambios de
  `authMiddleware.js`/`auth.js`.
- Confirmado que los 3 permisos usados en el diff (`ver_catalogo`, `ver_recetas`,
  `ver_costeo`, `ver_inventario`, `ver_compras`, `registrar_ventas`,
  `ver_produccion`) coinciden EXACTO con los valores reales en
  `usuarios.permisos` de staging (sin typos ni mayúsculas distintas).
- Las 3 páginas restauradas (`CajaProduccion.jsx`, `InventarioTerminado.jsx`,
  `Reportes.jsx`) no tienen incompatibilidades — usan `lib/api.js` sin cambios
  rotos, y sus rutas backend (`/api/lotes`, `/api/sucursales`,
  `/api/inventario-terminado`) siguen montadas en `index.js`.

### EN PROGRESO cuando se cortó la sesión — falta terminar:

1. **Verificación en staging (Paso 3 del plan) — a medio hacer.** Se recreó
   `backend/.env.staging` (mismo patrón de siempre — ver abajo), se mató un
   proceso viejo que quedó zombie en el puerto 3001 de una sesión anterior, y el
   backend está corriendo limpio contra staging con `jwt_configurado: true`.
   **Falta**: levantar el frontend (`npm run dev` en `frontend/`, sin
   `VITE_API_URL`, usa el proxy de Vite a `localhost:3001`), y probar en el
   navegador (login con `admin@marquez.com` / password que el dueño ya dio en
   esta sesión — no queda en este doc por seguridad, pedirlo de nuevo si hace
   falta, o probar con el operario real si se puede) que:
   - Un admin ve TODO el menú y accede a las 3 páginas restauradas sin errores
     de consola.
   - Un usuario no-admin (idealmente uno con permisos limitados tipo `sandra`)
     NO ve/no puede navegar a rutas que no le correspondan.
   - El botón de logout funciona: limpia sesión, redirige a `/login`, no se
     puede volver atrás sin loguearse de nuevo.
2. **Cerrar servidores de staging y borrar `backend/.env.staging`** al terminar
   (mismo criterio de higiene de siempre — nunca dejarlo commiteado; ya está en
   `.gitignore` vía regla `.env*`, pero igual se borra el archivo).
3. **NINGÚN COMMIT hecho todavía en esta rama.** El usuario dijo explícitamente
   que quiere ver el resultado de la verificación en staging antes de aprobar
   el commit.
4. Después del commit: push + abrir PR manualmente (link que da `git push`,
   ya que `gh` no está instalado) — sin mergear, eso lo hace el dueño desde
   GitHub.

## Patrones y convenciones aprendidas en esta sesión (aplican para todo lo que sigue)

- **Nunca imprimir credenciales/`DATABASE_URL`/`JWT_SECRET` en la salida de
  consola.** Para escribir un valor sensible a un archivo sin que aparezca en
  la transcripción, usar `railway run ... -- bash -c 'echo "X=$VAR" > archivo'`
  (el valor va directo al archivo, nunca pasa por mi output visible).
- **Producción = Supabase externo** (`aws-1-us-west-2.pooler.supabase.com`),
  accedido vía `railway run --environment production --service master-baker`.
  **Solo lectura salvo pedido explícito.**
- **Staging = Postgres propio de Railway** (ambiente `staging`, servicio
  `Postgres` separado del servicio de la app `master-baker`). Solo alcanzable
  desde fuera de Railway vía `DATABASE_PUBLIC_URL` del servicio `Postgres` (no
  el `DATABASE_URL` interno que usa el servicio `master-baker`, que es
  `postgres.railway.internal`, inalcanzable desde la máquina local). Ver
  `STAGING.md` en la raíz del repo para el detalle completo de backup/restore.
- **Para correr el backend local contra staging**: crear
  `backend/.env.staging` con las vars no sensibles copiadas de
  `railway run --environment staging --service master-baker -- bash -c 'echo ...'`
  más el `DATABASE_URL` sacado de
  `railway run --environment staging --service Postgres -- bash -c 'echo "DATABASE_URL=$DATABASE_PUBLIC_URL" >> backend/.env.staging'`,
  y arrancar con `DOTENV_CONFIG_PATH=.env.staging npm run dev` (nunca tocar el
  `backend/.env` real). **Siempre verificar puertos libres antes de arrancar**
  (`netstat -ano | grep ":3001 "` / `:5173`) — en esta sesión hubo más de una
  vez un proceso zombie de una corrida anterior ocupando el puerto.
- **Nunca hacer commit sin que el usuario apruebe el diff explícitamente
  primero** — en archivos grandes (`App.jsx`, `Layout.jsx`) el usuario pidió
  ver el diff completo (no solo un resumen) antes de cada aplicación.
- **`main` tiene branch protection** — todo el trabajo va en ramas nuevas +
  PR. `gh` no está instalado; los PRs se abren manualmente con el link que da
  `git push -u origin <rama>`.
- Cuando se investiga algo "solo diagnóstico", **no tocar código ni hacer
  cambios** hasta que el usuario diga explícitamente que aplique algo — este
  patrón se repitió mucho y el usuario es estricto con eso.
