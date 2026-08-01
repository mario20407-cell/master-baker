import 'dotenv/config'
import * as Sentry from '@sentry/node'

// Inicializar Sentry antes de cualquier otra importación/lógica
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  beforeSend(event) {
    // Sanitizar datos sensibles antes de enviarlos a Sentry
    const scrub = (str) => {
      if (typeof str !== 'string') return str
      return str
        .replace(/(password|contraseña|pass|token|jwt|auth|authorization|key|secret)\s*[:=]\s*["']?[^"'\s,;]+["']?/gi, '$1: [REDACTED]')
        .replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, 'Bearer [REDACTED]')
    }

    if (event.message) event.message = scrub(event.message)
    if (event.exception?.values) {
      for (const val of event.exception.values) {
        if (val.value) val.value = scrub(val.value)
        if (val.stacktrace?.frames) {
          for (const frame of val.stacktrace.frames) {
            if (frame.vars) {
              for (const key of Object.keys(frame.vars)) {
                if (/(password|contraseña|pass|token|jwt|auth|authorization|key|secret)/i.test(key)) {
                  frame.vars[key] = '[REDACTED]'
                }
              }
            }
          }
        }
      }
    }
    return event
  }
})

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
import sentryWebhookRoutes from './routes/sentryWebhook.js'
import { tenantMiddleware } from './middleware/tenantMiddleware.js'
import { query } from './db/client.js'
import { validarClaveConfigurada } from './utils/cifrado.js'


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

// Columna de revocación de sesiones (ver authMiddleware.js). No bloqueante,
// mismo patrón que arriba — en el primerísimo instante tras un deploy nuevo
// requireAuth podría toparse con la columna aún no creada; ese caso se
// degrada a un 500 controlado, nunca a un 401 falso ni a un crash.
query(`
  ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;
`).then(() => {
  console.log('   Esquema:     Columna token_version verificada')
}).catch(err => {
  console.warn('   Esquema:     (Aviso) No se pudo verificar token_version:', err.message)
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

  CREATE TABLE IF NOT EXISTS errores_sistema (
    id SERIAL PRIMARY KEY,
    sentry_id VARCHAR(255) UNIQUE,
    sentry_issue_id VARCHAR(255),
    tenant_id UUID,
    mensaje TEXT NOT NULL,
    stack TEXT,
    detalles JSONB,
    leido BOOLEAN NOT NULL DEFAULT false,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_errores_sistema_creado ON errores_sistema(creado_en DESC);
  CREATE INDEX IF NOT EXISTS idx_errores_sistema_leido ON errores_sistema(leido);
  CREATE INDEX IF NOT EXISTS idx_errores_sistema_issue ON errores_sistema(sentry_issue_id);

`).then(() => {
  console.log('   Esquema:     Tablas de métricas (ai_usage_log, actividad_heartbeats) verificadas')
}).catch(err => {
  console.warn('   Esquema:     (Aviso) No se pudieron verificar tablas de métricas:', err.message)
})

// RLS real por tenant (ver decisiones/2026-07-29-rls-real-diferido.md y
// backend/src/db/client.js). Crea el rol restringido `app_tenant_scoped`
// (sin BYPASSRLS) y le otorga exactamente los privilegios de tabla que
// necesita — nada más. No bloqueante y, por sí solo, inocuo: mientras
// RLS_TENANT_ENFORCE no esté en 'true' en Railway, ninguna query real usa
// este rol todavía (ver tenantQuery/transaction en db/client.js). Es
// seguro correr esto antes de que el código lo use — igual que el resto
// de patches de este archivo.
// NOTA (2026-08-01): este bloque y el de planillas/planilla_detalle de abajo
// se encadenan con .finally() en vez de dispararse como dos promesas
// independientes en paralelo. Antes de este cambio, ambos son DDL pesado
// (GRANT/ALTER DEFAULT PRIVILEGES sobre TODAS las tablas del primero, ALTER
// TABLE ... ENABLE/FORCE ROW LEVEL SECURITY sobre planillas/planilla_detalle
// del segundo) corriendo al mismo tiempo contra la misma base al arrancar el
// proceso — Postgres detectó un deadlock real entre ambos en el primer
// deploy que los tuvo juntos (ver Deploy Logs, 2026-07-31 23:50:49 CST:
// "No se pudo verificar rol app_tenant_scoped: deadlock detected"). El rol y
// sus GRANTs ya estaban bien establecidos de deploys anteriores, así que no
// hubo impacto real esa vez — pero encadenarlos evita que dependa de la
// suerte en el próximo deploy que sí necesite aplicar un cambio real.
const migracionRolTenantScoped = query(`
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_tenant_scoped') THEN
      CREATE ROLE app_tenant_scoped NOLOGIN;
    END IF;
  END $$;
  GRANT USAGE ON SCHEMA public TO app_tenant_scoped;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant_scoped;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tenant_scoped;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tenant_scoped;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_tenant_scoped;
  -- SET LOCAL ROLE (ver db/client.js) solo funciona si el rol de conexión es
  -- miembro de app_tenant_scoped (o superusuario). No asumimos que el rol de
  -- conexión sea superusuario — se le otorga membresía explícita al rol
  -- actual (current_user), sea cual sea su nombre real detrás del pooler de
  -- Supabase. Causa raíz del 500 en catalogo.js del primer intento de
  -- activar RLS_TENANT_ENFORCE (2026-07-31): faltaba exactamente este GRANT.
  DO $$
  BEGIN
    EXECUTE format('GRANT app_tenant_scoped TO %I', current_user);
  END $$;
`).then(() => {
  console.log('   Esquema:     Rol app_tenant_scoped (RLS real) verificado')
}).catch(err => {
  console.warn('   Esquema:     (Aviso) No se pudo verificar rol app_tenant_scoped:', err.message)
})

// planilla_detalle no tenía tenant_id propio (solo planilla_id → planillas
// → tenant_id, un JOIN de por medio) — insuficiente para que una política
// RLS `tenant_isolation` la evalúe directo (ver auditoría QA 2026-07-31,
// hallazgo CRÍTICO #1). Se agrega la columna, se rellena desde planillas
// para las filas que ya existan, y recién ahí se activa RLS sobre las dos
// tablas de planilla — en ese orden, para no dejar nunca una fila con
// tenant_id NULL bajo FORCE ROW LEVEL SECURITY (WITH CHECK la rechazaría).
// Encadenado con .finally() sobre la migración del rol de arriba (ver nota) —
// corre siempre, gane o pierda esa promesa, pero nunca al mismo tiempo.
migracionRolTenantScoped.finally(() => query(`
  ALTER TABLE planilla_detalle ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
  UPDATE planilla_detalle pd SET tenant_id = p.tenant_id
    FROM planillas p WHERE p.id = pd.planilla_id AND pd.tenant_id IS NULL;
  ALTER TABLE planilla_detalle ALTER COLUMN tenant_id SET NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_planilla_detalle_tenant ON planilla_detalle(tenant_id);

  ALTER TABLE planillas ENABLE ROW LEVEL SECURITY;
  ALTER TABLE planillas FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation ON planillas;
  CREATE POLICY tenant_isolation ON planillas
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

  ALTER TABLE planilla_detalle ENABLE ROW LEVEL SECURITY;
  ALTER TABLE planilla_detalle FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation ON planilla_detalle;
  CREATE POLICY tenant_isolation ON planilla_detalle
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
`).then(() => {
  console.log('   Esquema:     tenant_id + RLS en planillas/planilla_detalle verificados')
}).catch(err => {
  console.warn('   Esquema:     (Aviso) No se pudo verificar RLS de planillas/planilla_detalle:', err.message)
}))

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

// CRM del bot de WhatsApp: clientes, historial de mensajes persistente
// (reemplaza el Map en RAM, que se borraba en cada redeploy) y pedidos
// estructurados (con soporte para agendar y para avisar cuando estén listos).
// No bloqueante — igual que los patches anteriores.
query(`
  CREATE TABLE IF NOT EXISTS clientes_whatsapp (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    telefono VARCHAR(30) NOT NULL,
    nombre TEXT,
    notas TEXT,
    primera_interaccion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultima_interaccion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, telefono)
  );

  CREATE TABLE IF NOT EXISTS mensajes_whatsapp (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    cliente_id INT NOT NULL REFERENCES clientes_whatsapp(id) ON DELETE CASCADE,
    rol VARCHAR(10) NOT NULL,
    contenido TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_mensajes_whatsapp_cliente ON mensajes_whatsapp(cliente_id, creado_en);

  CREATE TABLE IF NOT EXISTS pedidos_whatsapp (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    cliente_id INT NOT NULL REFERENCES clientes_whatsapp(id) ON DELETE CASCADE,
    items JSONB NOT NULL DEFAULT '[]',
    total NUMERIC,
    direccion TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    tipo_entrega VARCHAR(20) NOT NULL DEFAULT 'inmediato',
    fecha_programada TIMESTAMPTZ,
    notificado_listo BOOLEAN NOT NULL DEFAULT false,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_pedidos_whatsapp_cliente ON pedidos_whatsapp(cliente_id, creado_en);
  CREATE INDEX IF NOT EXISTS idx_pedidos_whatsapp_tenant_estado ON pedidos_whatsapp(tenant_id, estado);
  CREATE INDEX IF NOT EXISTS idx_pedidos_whatsapp_programada ON pedidos_whatsapp(fecha_programada) WHERE tipo_entrega = 'agendado';
`).then(() => {
  console.log('   Esquema:     CRM WhatsApp (clientes_whatsapp, mensajes_whatsapp, pedidos_whatsapp) verificado')
}).catch(err => {
  console.warn('   Esquema:     (Aviso) No se pudo verificar CRM WhatsApp:', err.message)
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
    // Antes se confiaba en cualquier subdominio *.vercel.app (trivial de
    // crear por un tercero). Restringido a la allowlist explícita — si se
    // agrega un nuevo dominio de preview real, hay que sumarlo a la lista.
    if (!origin || allowedOrigins.includes(origin)) {
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

// Taggear automáticamente cada evento con req.tenantId en el scope de Sentry si está disponible
app.use((req, res, next) => {
  if (req.tenantId) {
    Sentry.setTag('tenant_id', req.tenantId)
  }
  next()
})


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
app.use('/api', sentryWebhookRoutes)


// Health check
app.get('/api/health', async (_, res, next) => {
  try {
    const { rows } = await query('SELECT COUNT(*)::int AS count FROM tenant_whatsapp_config WHERE activo = true')
    const tenantsActivos = rows[0]?.count || 0

    res.json({
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
        activo: tenantsActivos > 0,
        tenants_activos: tenantsActivos,
      },
      admin_pin: 'por tenant (ver /api/admin-pin/estado con sesión de admin)',
      jwt_configurado:       !!process.env.JWT_SECRET,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    next(e)
  }
})

// Errores
Sentry.setupExpressErrorHandler(app)

app.use((err, req, res, _next) => {
  console.error('[Error]', err.message)
  // Los errores "de negocio" (validaciones, 4xx) ya setean err.status y su
  // mensaje es seguro para mostrar. Para todo lo demás (500 no manejado —
  // puede traer detalles crudos del driver de Postgres, nombres de columna,
  // etc.) se responde un mensaje genérico; el detalle real queda en el log
  // del servidor, no en la respuesta al cliente.
  const status = err.status || 500
  const mensaje = err.status ? (err.message || 'Error') : 'Error interno del servidor'
  res.status(status).json({ error: mensaje })
})


if (process.env.NODE_ENV !== 'test') {
  // Si hay algún tenant con WhatsApp configurado, la clave de cifrado tiene
  // que estar bien configurada — si no, el bot arranca en silencio y deja
  // de responder para todos los tenants (ya pasó una vez, con el token
  // vencido). No abortamos el arranque completo por esto: el resto del
  // sistema (panel, ventas, inventario, etc.) no depende del bot de
  // WhatsApp para funcionar, así que tirar todo el servidor abajo por un
  // problema aislado del bot sería desproporcionado. Se loguea fuerte en
  // su lugar para que sea imposible no notarlo.
  const { rows: [{ count: tenantsConWhatsapp }] } = await query(
    'SELECT COUNT(*)::int AS count FROM tenant_whatsapp_config'
  )
  if (tenantsConWhatsapp > 0) {
    try {
      validarClaveConfigurada()
    } catch (e) {
      console.error('❌ WHATSAPP_TOKEN_ENCRYPTION_KEY falta o es inválida — el bot de WhatsApp no podrá responder a ningún tenant.')
      console.error(`   Detalle: ${e.message}`)
    }

    // El webhook ahora rechaza requests si falta META_APP_SECRET (fail-closed,
    // ver routes/whatsapp.js), pero eso significa que el bot deja de recibir
    // mensajes en silencio si la variable se cae. Se loguea fuerte al arranque
    // para que sea imposible no notarlo, igual que con la clave de cifrado.
    if (!process.env.META_APP_SECRET) {
      console.error('❌ META_APP_SECRET no configurado — el webhook de WhatsApp va a rechazar todos los mensajes entrantes.')
    }
  }

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
    console.log(`   WhatsApp Bot:       multi-tenant (ver /api/whatsapp/estado o tenant_whatsapp_config)`)
    console.log(`   Webhook URL:        http://localhost:${PORT}/api/whatsapp/webhook\n`)
  })
}

export default app