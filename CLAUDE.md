# CLAUDE.md — Marquéz Panadería & Repostería

## Proyecto

Sistema de gestión para panadería: costeo de recetas, inventario, ventas (POS), facturación fiscal y asistente IA por WhatsApp. Desplegado en producción en `masterbaker.store` (frontend en Vercel, proyecto `marquez-app-v27`; backend en Railway; DB en Supabase).

## Stack

| Capa | Tech |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS + React Router |
| Backend | Node.js (ESM) + Express 4 |
| Base de datos | PostgreSQL vía Supabase (`pg` pool) |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` — implementado y en producción, ver sección Auth |
| IA | Claude Sonnet (lógica), GPT-4o-mini (chat/WhatsApp), DeepSeek V3/R1 (costeo), Gemini 2.5 Flash (PDFs) |
| Tests | Vitest + Supertest (backend), Vitest (frontend) |

## Módulos en producción

| Módulo | Ruta frontend | Notas |
|---|---|---|
| Dashboard | `/dashboard` | 4 filas: F1 Hero del día (ventas/ingresos/stock crítico, filtrado por fecha Nicaragua), F2 Presupuesto del mes + Caja del día, F3 Alertas activas + Últimas ventas (columna Fecha/Hora en formato "3 jul 07:34"), F4 Análisis colapsable (rentabilidad, categorías, estado de recetas) |
| Catálogo | `/catalogo` | Lista estática + botón "Importar desde Excel" |
| Recetas | `/recetas` | Costeo por receta |
| Costeo / Escalado | `/costeo`, `/escalado` | Módulos en construcción (stubs) |
| Inventario (insumos) | `/inventario` | CRUD + "Importar desde Excel" (plantillas en `frontend/public/plantillas/`) |
| Compras | `/compras` | Registrar factura → upsert automático a `inventario` (suma existencia, crea insumo si no existe) |
| Caja de Producción | `/caja` | Registro de hornadas y ventas del día por lote |
| Ventas (POS) | `/ventas` | Carrito, selección de sucursal, métodos de pago (efectivo/tarjeta/transferencia), descuenta `inventario_terminado` al vender |
| Stock Terminado | `/stock` | Inventario de producto terminado multi-sucursal, alertas de stock bajo, distribución entre sucursales |
| Reportes | `/reportes` | 3 pestañas: Rentabilidad, Inventario, Ventas (con filtros: rango de fecha, sucursal, método de pago, búsqueda de producto — actualización automática, "Exportar PDF" vía `window.print()`) |
| Usuarios | `/usuarios` | Gestión de usuarios + configuración de alertas WhatsApp (números destino) |
| Config. Fiscal | `/fiscal` | Régimen cuota fija, prorrateo |
| Exportar | `/exportar` | Exportación CSV (catálogo, recetas, costeos, inventario, compras, reporte ejecutivo) — requiere auth y filtra por `tenant_id` en todas las queries |
| Consultar IA | `/ia` | Chat con IA (WhatsApp usa el mismo `aiProvider.js`) |
| Alertas WhatsApp | — (backend) | `backend/src/services/alertas.js` — dispara alertas de stock bajo (`checkStockTerminado`, `checkInventarioInsumos`) vía Meta Cloud API |

## Auth (implementado, en producción)

- Login con JWT: `POST /api/auth/login` (`backend/src/routes/auth.js`), contraseñas hasheadas con `bcryptjs`.
- `backend/src/middleware/authMiddleware.js` — `requireAuth` protege rutas; hay verificación de rol (`requireRol('admin')`) usada en endpoints sensibles (ej. distribución de stock entre sucursales).
- Frontend: `frontend/src/context/AuthContext.jsx` maneja sesión/token (`localStorage: marquez_token`), `Login.jsx` es la pantalla de acceso, rutas protegidas redirigen a `/login` si no hay sesión válida.
- Interceptor de `frontend/src/lib/api.js` adjunta `Authorization: Bearer <token>` y hace logout automático (redirige a `/login`) en 401.

## Estructura

```
marquez-app/
├── backend/
│   ├── src/
│   │   ├── index.js              # Entry point — monta rutas, NO importar en tests
│   │   ├── db/client.js          # Pool pg: query(), transaction(), getClient()
│   │   ├── middleware/
│   │   │   └── tenantMiddleware.js   # Resuelve req.tenantId
│   │   ├── routes/               # catalogo, recetas, costeos, inventario,
│   │   │   │                     # compras, ventas, fiscal, usuarios,
│   │   │   │                     # ai-router, whatsapp, exportar
│   │   ├── services/ai/
│   │   │   └── aiProvider.js     # Adaptadores unificados para los 4 proveedores
│   │   └── __tests__/            # Vitest — mocks de db/client.js, supertest
│   └── vitest.config.js
└── frontend/
    ├── src/
    │   ├── lib/api.js             # Axios instance con interceptores
    │   ├── lib/catalogo.js        # PRODUCTOS[], CATEGORIAS[], CAT_COLORS
    │   ├── lib/costeo.js          # Lógica de costeo pura (sin API)
    │   ├── pages/                 # Una página por ruta
    │   ├── hooks/                 # useRecetas, useVentas, useFiscalConfig
    │   └── components/Layout.jsx  # Sidebar + navegación
    └── src/lib/__tests__/         # Vitest — tests de costeo.js
```

## Multi-tenancy

- **Toda** query filtra por `tenant_id`. Sin excepción.
- Tenant actual: UUID `00000000-0000-0000-0000-000000000001` (Marquéz).
- Para tests: enviar header `x-tenant-id: <uuid>` — el middleware lo usa directamente.

## Reglas de negocio clave

| Regla | Detalle |
|---|---|
| Margen aprobado | `margen_pct >= 57` → `aprobado = true` en costeos |
| Régimen cuota fija | Requiere `cuota_fija > 0` y `produccion_mensual >= 1` |
| Total venta | Debe coincidir con suma de items ±$0.01, validado en el backend |
| Alerta compras | `variacion_pct > 10%` en precio de insumo → `alerta = true` |
| Prorrateo fiscal | `cuota / produccion_mensual` — cálculo stateless, sin DB |

## Variables de entorno importantes

```
# Backend
DATABASE_URL          PostgreSQL connection string (Supabase)
PORT                  Default 3001
FRONTEND_URL          Para CORS (default http://localhost:5173)
ANTHROPIC_API_KEY     Claude Sonnet 4.6
OPENAI_API_KEY        GPT-4o-mini (chat WhatsApp)
DEEPSEEK_API_KEY      DeepSeek V3/R1 (costeo)
GEMINI_API_KEY        Gemini 2.5 Flash (PDFs)
WHATSAPP_TOKEN        Meta Cloud API
WHATSAPP_PHONE_ID     ID del número de WhatsApp
JWT_SECRET            Firma de tokens JWT (auth implementado — ver sección Auth)

# Frontend
VITE_API_URL          URL del backend (default /api en prod)
```

## Comandos

```bash
# Backend
npm run dev           # nodemon
npm test              # vitest run (62 tests, sin DB real)

# Frontend
npm run dev           # vite dev
npm run build         # vite build
npm test              # vitest run (55 tests)
```

## Patrones de código

- **Rutas**: cada archivo de ruta es un `Router()` independiente. Error handling via `next(e)`.
- **Transacciones**: usar `transaction(async (client) => { ... })` de `db/client.js`.
- **AI routing**: todo pasa por `aiProvider.js`. `AI_CONFIG.USE_MOCKS = true` para tests sin API keys.
- **Tests de rutas**: crear mini-app Express con `makeApp(router)` de `src/__tests__/test-utils.js`, mockear `../db/client.js` con `vi.mock()`. NO importar `index.js` en tests (llama a `app.listen()`).

## Pendientes / bugs conocidos

- Reporte de Rentabilidad: algunos productos muestran márgenes/utilidades absurdamente negativos (costeo de receta mal configurado, no es bug de código).
- Datos duplicados por typo en Stock Terminado (ej. dos productos casi idénticos con nombre mal escrito) — fragmenta conteos de stock.
- `backend/src/db/schema.sql` está desincronizado del schema real: no define `sucursales` ni `inventario_terminado` (existen en producción pero no en el archivo). Correr `db:migrate` contra una base nueva desde cero fallaría.
- Ventas registradas antes de que `ventas.sucursal_id` existiera aparecen como "Sin sucursal" en los reportes — esperado, no recuperable.

## Reglas de ahorro de tokens

- Usar `Grep` antes de `Read` — buscar el símbolo exacto, no leer archivos enteros.
- Para exploración amplia (> 3 queries), usar agente `Explore` en lugar de herramientas directas.
- No re-leer archivos recién editados — el sistema rastrea el estado.
- Los tests del backend no necesitan DB real; los mocks en `vi.mock('../db/client.js')` cubren todo.
- Preferir `Edit` sobre `Write` para modificaciones parciales — solo envía el diff.
