import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import catalogoRoutes   from './routes/catalogo.js'
import recetasRoutes    from './routes/recetas.js'
import costeosRoutes    from './routes/costeos.js'
import inventarioRoutes from './routes/inventario.js'
import comprasRoutes    from './routes/compras.js'
import exportarRoutes   from './routes/exportar.js'
import aiRouterRoutes   from './routes/ai-router.js'
import whatsappRoutes   from './routes/whatsapp.js'
import fiscalRoutes     from './routes/fiscal.js'
import ventasRoutes     from './routes/ventas.js'
import authRoutes       from './routes/auth.js'
import produccionRoutes from './routes/produccion.js'
import inventarioTerminadoRoutes from './routes/inventario-terminado.js'
import lotesRoutes      from './routes/lotes.js'
import sucursalesRoutes from './routes/sucursales.js'
import sugerenciasProduccionRoutes from './routes/sugerencias-produccion.js'
import adminRoutes      from './routes/admin.js'
import actividadRoutes  from './routes/actividad.js'
import pasivosLaboralesRoutes from './routes/pasivosLaborales.js'
import adminPinRoutes   from './routes/adminPin.js'
import { tenantMiddleware } from './middleware/tenantMiddleware.js'
import { query } from './db/client.js'

// Asegurar columnas de auditoría y trial en producción de forma no bloqueante
query(`
  ALTER TABLE auditoria_precios ADD COLUMN IF NOT EXISTS valor_anterior_texto VARCHAR(255);
  ALTER TABLE auditoria_precios ADD COLUMN IF NOT EXISTS valor_nuevo_texto VARCHAR(255);
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_vence_en TIMESTAMPTZ;
  UPDATE tenants SET trial_vence_en = creado_en + INTERVAL '30 days' WHERE trial_vence_en IS NULL;
`).then(() => {
  console.log('   Esquema:     Columnas de auditoría y trial_vence_en verificadas')
}).catch(err => {
  console.warn('   Esquema:     (Aviso) No se pudieron verificar columnas:', err.message)
})

// Tablas para métricas del panel de fundadores: consumo de tokens de IA y
// actividad de pantalla por tenant. No bloqueante — igual que el patch de arriba.
query(`
  CREATE TABLE IF NOT EXISTS ai_usage_log (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    input_tokens INT NOT NULL DEFAULT 0,
    output_tokens INT NOT NULL DEFAULT 0,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_ai_usage_log_tenant ON ai_usage_log(tenant_id, creado_en);

  CREATE TABLE IF NOT EXISTS actividad_heartbeats (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    usuario_id UUID,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_actividad_heartbeats_tenant ON actividad_heartbeats(tenant_id, creado_en);
`).then(() => {
  console.log('   Esquema:     Tablas de métricas (ai_usage_log, actividad_heartbeats) verificadas')
}).catch(err => {
  console.warn('   Esquema:     (Aviso) No se pudieron verificar tablas de métricas:', err.message)
})

// Perfil laboral por colaborador (salario/tipo de pago/fecha de ingreso)
// e historial de pagos variables (destajo, ej. pago por quintal), para el
// dossier de pasivos laborales (INSS, aguinaldo, vacaciones, indemnización).
// No bloqueante — igual que los patches anteriores.
query(`
  ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tipo_pago VARCHAR(10) NOT NULL DEFAULT 'fijo';
  ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS salario_mensual NUMERIC;
  ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_ingreso DATE;

  CREATE TABLE IF NOT EXISTS pagos_variables (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    usuario_id UUID NOT NULL,
    mes DATE NOT NULL,
    monto NUMERIC NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(usuario_id, mes)
  );
  CREATE INDEX IF NOT EXISTS idx_pagos_variables_usuario ON pagos_variables(usuario_id, mes DESC);
`).then(() => {
  console.log('   Esquema:     Perfil laboral y pagos_variables (pasivos laborales) verificados')
}).catch(err => {
  console.warn('   Esquema:     (Aviso) No se pudieron verificar tablas de pasivos laborales:', err.message)
})

// PIN de administrador por tenant (reemplaza la variable de entorno global
// ADMIN_PIN — ver middleware/adminPinMiddleware.js y routes/adminPin.js).
// No bloqueante — igual que los patches anteriores.
query(`
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS admin_pin_hash TEXT;
`).then(() => {
  console.log('   Esquema:     Columna admin_pin_hash en tenants verificada')
}).catch(err => {
  console.warn('   Esquema:     (Aviso) No se pudo verificar admin_pin_hash:', err.message)
})

const app = express()
const PORT = process.env.PORT || 3001

// Railway corre la app detrás de un proxy/load balancer. Sin esto,
// express-rate-limit lanza un error (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
// en cada request porque no confía en el header X-Forwarded-For.
app.set('trust proxy', 1)

// Montado antes del CORS/helmet globales: el panel de estado de fundadores
// vive fuera de los dominios de la app y necesita su propio CORS abierto
// (protegido por ADMIN_TOKEN, no por origen). Ver routes/admin.js.
app.use('/api/admin', adminRoutes)

app.use(helmet())

const allowedOrigins = [
  'http://localhost:5173',
  'https://www.masterbaker.store',
  'https://masterbaker.store',
  'https://marquez-app-v27.vercel.app'
]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))
app.use(morgan('dev'))
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf
  }
}))
app.use(express.urlencoded({ extended: true }))

// Rate limiting global
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }))

// Resuelve req.tenantId en cada request — DEBE ir antes de las rutas /api
app.use(tenantMiddleware)

// Rate limiting IA
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 30,
  message: { error: 'Demasiadas consultas. Espera un minuto.' } })

// Rutas
app.use('/api/auth',       authRoutes)
app.use('/api/catalogo',   catalogoRoutes)
app.use('/api/recetas',    recetasRoutes)
app.use('/api/costeos',    costeosRoutes)
app.use('/api/inventario', inventarioRoutes)
app.use('/api/compras',    comprasRoutes)
app.use('/api/exportar',   exportarRoutes)
app.use('/api/ai',         aiLimiter, aiRouterRoutes)
app.use('/api/whatsapp',   whatsappRoutes)
app.use('/api/fiscal',     fiscalRoutes)
app.use('/api/ventas',     ventasRoutes)
app.use('/api/produccion', produccionRoutes)
app.use('/api/inventario-terminado', inventarioTerminadoRoutes)
app.use('/api/lotes',      lotesRoutes)
app.use('/api/sucursales', sucursalesRoutes)
app.use('/api/sugerencias-produccion', sugerenciasProduccionRoutes)
app.use('/api/actividad', actividadRoutes)
app.use('/api/pasivos-laborales', pasivosLaboralesRoutes)
app.use('/api/admin-pin', adminPinRoutes)

// Health check
app.get('/api/health', (_, res) => res.json({
  status: 'ok', version: '3.0',
  negocio: 'Marquéz Panadería & Repostería',
  auth: { login: '/api/auth/login', registro_cerrado: true },
  ia: {
    openai:    !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    deepseek:  !!process.env.DEEPSEEK_API_KEY,
    gemini:    !!process.env.GEMINI_API_KEY,
  },
  whatsapp: {
    activo:   !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID,
    phone_id: process.env.WHATSAPP_PHONE_ID || 'No configurado',
  },
  admin_pin: 'por tenant (ver /api/admin-pin/estado con sesión de admin)',
  jwt_configurado:       !!process.env.JWT_SECRET,
  timestamp: new Date().toISOString(),
}))

// Errores
app.use((err, req, res, _next) => {
  console.error('[Error]', err.message)
  res.status(err.status || 500).json({ error: err.message || 'Error interno' })
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`\n🥐 Maestro Panadero IA — Marquéz v3.0`)
    console.log(`   Servidor:    http://localhost:${PORT}`)
    console.log(`   Auth:        /api/auth/login | /api/auth/registrar | /api/auth/me`)
    console.log(`   Rutas:       catalogo | recetas | costeos | inventario | compras | ventas | fiscal | ai | whatsapp`)
    console.log(`   IA activas:`)
    console.log(`   - GPT-4 mini:       ${process.env.OPENAI_API_KEY    ? '✅' : '⏳ pendiente'}`)
    console.log(`   - Claude 3.5:       ${process.env.ANTHROPIC_API_KEY ? '✅' : '⏳ pendiente'}`)
    console.log(`   - DeepSeek V3/R1:   ${process.env.DEEPSEEK_API_KEY  ? '✅' : '⏳ pendiente'}`)
    console.log(`   - Gemini 1.5 Flash: ${process.env.GEMINI_API_KEY    ? '✅' : '⏳ pendiente'}`)
    console.log(`   WhatsApp Bot:       ${process.env.WHATSAPP_TOKEN     ? '✅ activo' : '⏳ pendiente'}`)
    console.log(`   Webhook URL:        http://localhost:${PORT}/api/whatsapp/webhook\n`)
  })
}

export default app
