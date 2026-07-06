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

const app = express()
const PORT = process.env.PORT || 3001

// Railway corre la app detrás de un proxy/load balancer. Sin esto,
// express-rate-limit lanza un error (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
// en cada request porque no confía en el header X-Forwarded-For.
app.set('trust proxy', 1)

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
app.use(express.json({ limit: '10mb' }))
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
  admin_pin_configurado: !!process.env.ADMIN_PIN,
  jwt_configurado:       !!process.env.JWT_SECRET,
  timestamp: new Date().toISOString(),
}))

// Errores
app.use((err, req, res, _next) => {
  console.error('[Error]', err.message)
  res.status(err.status || 500).json({ error: err.message || 'Error interno' })
})

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

export default app