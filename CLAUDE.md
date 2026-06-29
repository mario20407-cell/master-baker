# CLAUDE.md — Marquéz Panadería & Repostería

## Proyecto

Sistema de gestión para panadería: costeo de recetas, inventario, ventas, facturación fiscal y asistente IA por WhatsApp.

## Stack

| Capa | Tech |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS + React Router |
| Backend | Node.js (ESM) + Express 4 |
| Base de datos | PostgreSQL vía Supabase (`pg` pool) |
| IA | Claude Sonnet (lógica), GPT-4o-mini (chat/WhatsApp), DeepSeek V3/R1 (costeo), Gemini 2.5 Flash (PDFs) |
| Tests | Vitest + Supertest (backend), Vitest (frontend) |

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
- `exportar.js` NO filtra por tenant — bug conocido, no tocar sin análisis de impacto.

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
JWT_SECRET            Para tokens (auth pendiente de implementar)

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

## Reglas de ahorro de tokens

- Usar `Grep` antes de `Read` — buscar el símbolo exacto, no leer archivos enteros.
- Para exploración amplia (> 3 queries), usar agente `Explore` en lugar de herramientas directas.
- No re-leer archivos recién editados — el sistema rastrea el estado.
- Los tests del backend no necesitan DB real; los mocks en `vi.mock('../db/client.js')` cubren todo.
- Preferir `Edit` sobre `Write` para modificaciones parciales — solo envía el diff.
