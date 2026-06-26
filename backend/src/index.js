import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import catalogoRoutes    from './routes/catalogo.js'
import recetasRoutes     from './routes/recetas.js'
import costeosRoutes     from './routes/costeos.js'
import inventarioRoutes  from './routes/inventario.js'
import comprasRoutes     from './routes/compras.js'
import exportarRoutes    from './routes/exportar.js'
import aiRouterRoutes    from './routes/ai-router.js'
import whatsappRoutes    from './routes/whatsapp.js'
import fiscalRoutes      from './routes/fiscal.js'
import ventasRoutes      from './routes/ventas.js'
import authRoutes        from './routes/auth.js'
import produccionRoutes  from './routes/produccion.js'
import { tenantMiddleware } from './middleware/tenantMiddleware.js'
import { requireAuth }      from './middleware/authMiddleware.js'

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET no configurado')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL no configurado')
  process.exit(1)
}

const app  = express()
const PORT = process.env.PORT || 3001
app.set('trust proxy', 1)

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc:  ["'none'"],
      frameSrc:   ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: false
}))

const allowedOrigins = [
  'https://masterbaker.store',
  'https://www.masterbaker.store',
  'https://marquez-app-v27.vercel.app',
  'http://localhost:5173'
]
app.use(cors({
  origin: (origin, cb) => cb(null, allowedOrigins.includes(origin) || !origin),
  credentials: true
}))

app.use(morgan('dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(tenantMiddleware)

const globalLimiter = rateLimit({ windowMs: 60*1000, max: 200, message: { error: 'Demasiadas solicitudes.' }, standardHeaders: true, legacyHeaders: false })
const loginLimiter  = rateLimit({ windowMs: 15*60*1000, max: 10, message: { error: 'Demasiados intentos. Espera 15 minutos.' }, standardHeaders: true, legacyHeaders: false })
const aiLimiter     = rateLimit({ windowMs: 60*1000, max: 30, message: { error: 'Demasiadas consultas a la IA.' }, standardHeaders: true, legacyHeaders: false })

app.get('/api/health', (_, res) => res.json({ status: 'ok', version: '3.5', timestamp: new Date().toISOString() }))

app.use(globalLimiter)

app.use('/api/auth/login',       loginLimiter)
app.use('/api/auth',             authRoutes)
app.use('/api/whatsapp/webhook', whatsappRoutes)

app.use(requireAuth)

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

app.use((err, req, res, _next) => {
  console.error('[Error]', err.message)
  const status = err.status || 500
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Error interno del servidor'
    : err.message || 'Error interno'
  res.status(status).json({ error: message })
})

app.listen(PORT, () => console.log('Master Baker v3.5 en puerto ' + PORT))

export default app
