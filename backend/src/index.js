import dotenv from 'dotenv'
// Load .env (local dev) then .env.txt as fallback for empty/missing vars
dotenv.config()
const envTxt = dotenv.config({ path: '.env.txt' })
if (envTxt.parsed) {
  for (const [k, v] of Object.entries(envTxt.parsed)) {
    if (!process.env[k] && v) process.env[k] = v
  }
}
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import authRoutes       from './routes/auth.js'
import catalogoRoutes   from './routes/catalogo.js'
import recetasRoutes    from './routes/recetas.js'
import costeosRoutes    from './routes/costeos.js'
import inventarioRoutes from './routes/inventario.js'
import comprasRoutes    from './routes/compras.js'
import exportarRoutes   from './routes/exportar.js'
import aiRouterRoutes   from './routes/ai-router.js'
import whatsappRoutes   from './routes/whatsapp.js'
import fiscalRoutes     from './routes/fiscal.js'
import usuariosRoutes from './routes/usuarios.js'
import ventasRoutes     from './routes/ventas.js'
import lotesRoutes             from './routes/lotes.js'
import sucursalesRoutes        from './routes/sucursales.js'
import inventarioTerminadoRoutes from './routes/inventario-terminado.js'
import { tenantMiddleware } from './middleware/tenantMiddleware.js'

const app = express()
const PORT = process.env.PORT || 3001


app.use(helmet())
const allowedOrigins = [
  'https://masterbaker.store',
  'https://www.masterbaker.store',
  'https://marquez-app-v27.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  ...( process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(s => s.trim()) : [] ),
]
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
  credentials: true,
}))
app.use(morgan('dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Rate limiting global
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }))

// Resuelve req.tenantId en cada request â€” DEBE ir antes de las rutas /api
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
app.use('/api/usuarios', usuariosRoutes)
app.use('/api/ventas',     ventasRoutes)
app.use('/api/lotes',               lotesRoutes)
app.use('/api/sucursales',          sucursalesRoutes)
app.use('/api/inventario-terminado', inventarioTerminadoRoutes)

// Health check
app.get('/api/health', (_, res) => res.json({
  status: 'ok', version: '2.7',
  negocio: 'Marquéz Panadería & Repostería',
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
  auth: {
    jwt_secret: !!process.env.JWT_SECRET,
  },
  cors_origins: allowedOrigins,
  timestamp: new Date().toISOString(),
}))

// Errores
app.use((err, req, res, _next) => {
  console.error('[Error]', err.message)
  res.status(err.status || 500).json({ error: err.message || 'Error interno' })
})

app.listen(PORT, () => {
  console.log(`\nðŸ¥ Maestro Panadero IA â€” MarquÃ©z v2.7`)
  console.log(`   Servidor:    http://localhost:${PORT}`)
  console.log(`   Rutas:       catalogo | recetas | costeos | inventario | compras | ventas | fiscal | ai | whatsapp`)
  console.log(`   IA activas:`)
  console.log(`   - GPT-4 mini:       ${process.env.OPENAI_API_KEY    ? 'âœ…' : 'â³ pendiente'}`)
  console.log(`   - Claude 3.5:       ${process.env.ANTHROPIC_API_KEY ? 'âœ…' : 'â³ pendiente'}`)
  console.log(`   - DeepSeek V3/R1:   ${process.env.DEEPSEEK_API_KEY  ? 'âœ…' : 'â³ pendiente'}`)
  console.log(`   - Gemini 1.5 Flash: ${process.env.GEMINI_API_KEY    ? 'âœ…' : 'â³ pendiente'}`)
  console.log(`   WhatsApp Bot:       ${process.env.WHATSAPP_TOKEN     ? 'âœ… activo' : 'â³ pendiente'}`)
  console.log(`   Webhook URL:        http://localhost:${PORT}/api/whatsapp/webhook\n`)
})

export default app




