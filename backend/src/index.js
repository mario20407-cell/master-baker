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
const app = express()
const PORT = process.env.PORT || 3001
app.set('trust proxy', 1)
app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }))
app.use(morgan('dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }))
app.use(tenantMiddleware)
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Demasiadas consultas.' } })
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
app.get('/api/health', (_, res) => res.json({
  status: 'ok', version: '3.0',
  negocio: 'Marquez Panaderia y Reposteria',
  auth: { login: '/api/auth/login', registro_cerrado: true },
  ia: { openai: !!process.env.OPENAI_API_KEY, anthropic: !!process.env.ANTHROPIC_API_KEY, deepseek: !!process.env.DEEPSEEK_API_KEY, gemini: !!process.env.GEMINI_API_KEY },
  whatsapp: { activo: !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID, phone_id: process.env.WHATSAPP_PHONE_ID || 'No configurado' },
  admin_pin_configurado: !!process.env.ADMIN_PIN,
  jwt_configurado: !!process.env.JWT_SECRET,
  timestamp: new Date().toISOString(),
}))
app.use((err, req, res, _next) => {
  console.error('[Error]', err.message)
  res.status(err.status || 500).json({ error: err.message || 'Error interno' })
})
app.listen(PORT, () => {
  console.log('Marquez v3.0 corriendo en puerto ' + PORT)
})
export default app
