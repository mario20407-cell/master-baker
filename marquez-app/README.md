# Maestro Panadero IA — Marquéz Panadería & Repostería

Sistema completo de gestión de producción, costeo, inventario y rentabilidad.

## Stack

| Capa | Tecnología | Hosting sugerido |
|------|-----------|-----------------|
| Frontend | React 18 + Vite + TailwindCSS | Vercel / Netlify |
| Backend | Node.js + Express | Railway / Render |
| Base de datos | PostgreSQL (Supabase) | Supabase (gratis) |
| IA | Anthropic Claude API | api.anthropic.com |
| PWA | vite-plugin-pwa | — |

## Inicio rápido

### 1. Clonar y configurar
```bash
git clone <tu-repo>
cd marquez-app
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
# Editar .env con tus credenciales
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Editar .env con la URL del backend
npm run dev
```

## Variables de entorno

### Backend `.env`
```
PORT=3001
DATABASE_URL=postgresql://user:password@host:5432/marquez
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=tu_secreto_seguro_aqui
FRONTEND_URL=http://localhost:5173
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:3001
VITE_APP_NAME=Marquéz Panadería
```

## Estructura del proyecto

```
marquez-app/
├── frontend/              # React + Vite + TailwindCSS
│   ├── src/
│   │   ├── components/    # Componentes reutilizables
│   │   ├── pages/         # Páginas principales
│   │   ├── hooks/         # Custom hooks
│   │   └── lib/           # Utilidades y API client
│   └── public/
├── backend/               # Node.js + Express
│   ├── src/
│   │   ├── routes/        # Endpoints REST
│   │   ├── middleware/    # Auth, validación
│   │   └── db/            # Esquema y queries
│   └── .env.example
└── README.md
```

## Despliegue en producción

### Vercel (frontend)
```bash
cd frontend
npx vercel --prod
```

### Railway (backend)
1. Conecta tu repo en railway.app
2. Agrega las variables de entorno
3. Deploy automático en cada push a main

### Supabase (base de datos)
1. Crea proyecto en supabase.com
2. Copia la DATABASE_URL al .env del backend
3. Ejecuta: `npm run db:migrate`

## Módulos del sistema

- **Catálogo** — 49 productos con precio y presentación
- **Recetas** — Formulario + import CSV + pegar tabla
- **Costeo** — Cálculo automático desde receta con validación de margen ≥57% (con y sin prorrateo fiscal DGI)
- **Escalado** — Factor de escala, merma y peso total
- **Inventario** — Existencias, días restantes, alertas
- **Compras** — Análisis de facturas y detección de alzas >10%
- **IA** — Chat con Claude con contexto del negocio
- **Exportar** — CSV de todos los módulos

## Margen objetivo: ≥ 57%

El sistema bloquea operaciones que no cumplan el margen mínimo y genera alertas automáticas.

## Versión

v2.7 — Módulo fiscal DGI con prorrateo, tabla config_fiscal, /api/fiscal y /api/ventas.
