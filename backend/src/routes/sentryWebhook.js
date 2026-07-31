import { Router } from 'express'
import crypto from 'crypto'
import { query } from '../db/client.js'

const router = Router()

// Helper para enviar alertas de correo utilizando Resend o SendGrid sin dependencias
async function enviarEmailAlerta(issueId, mensaje, stack, tenantId) {
  const apiKey = process.env.EMAIL_API_KEY
  const from = process.env.EMAIL_FROM || 'alertas@masterbaker.store'
  const to = process.env.DEVELOPER_EMAIL

  if (!apiKey || !to) {
    console.warn('[Sentry Webhook] EMAIL_API_KEY o DEVELOPER_EMAIL no configurado. Omitiendo alerta.')
    return
  }

  const subject = `🚨 [Error de Sistema] Master Baker — Issue #${issueId}`
  const bodyHtml = `
    <h2>Nuevo Error Capturado</h2>
    <p><strong>Mensaje:</strong> ${mensaje}</p>
    <p><strong>Tenant ID:</strong> ${tenantId || 'Ninguno (Global)'}</p>
    <p><strong>Sentry Issue ID:</strong> ${issueId}</p>
    <br>
    <h3>Stack Trace:</h3>
    <pre style="background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto;">${stack || 'No disponible'}</pre>
    <br>
    <p><em>Este correo fue generado automáticamente por Master Baker.</em></p>
  `

  try {
    if (apiKey.startsWith('SG.') || apiKey.toLowerCase().includes('sendgrid')) {
      // Usar API de SendGrid
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from, name: 'Master Baker Alertas' },
          subject: subject,
          content: [{ type: 'text/html', value: bodyHtml }]
        })
      })
    } else {
      // Defecto: Usar API de Resend
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `Master Baker Alertas <${from}>`,
          to: to,
          subject: subject,
          html: bodyHtml
        })
      })
    }
    console.log(`[Sentry Webhook] Alerta de email enviada exitosamente a ${to}`)
  } catch (error) {
    console.error('[Sentry Webhook] Error al enviar email de alerta:', error.message)
  }
}

router.post('/sentry-webhook', async (req, res) => {
  // Sentry firma sus webhooks (Internal Integration) con el header
  // 'sentry-hook-signature' — NO 'x-hub-signature-256' (eso es la convención
  // de GitHub/Meta). Usar el header equivocado hace que la firma nunca
  // valide, sin importar qué tan bien esté armado el HMAC.
  const signatureHeader = req.headers['sentry-hook-signature']
  const webhookSecret = process.env.SENTRY_WEBHOOK_SECRET

  // Validación robusta: Fallar cerrado
  if (!webhookSecret) {
    console.error('[Sentry Webhook] SENTRY_WEBHOOK_SECRET no configurado.')
    return res.status(503).json({ error: 'Webhook secret no configurado en el servidor' })
  }

  if (!signatureHeader) {
    console.error('[Sentry Webhook] Firma sentry-hook-signature ausente')
    return res.status(401).send('Firma ausente')
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(req.rawBody || '')
    .digest('hex')

  const signatureBuffer = Buffer.from(signatureHeader, 'utf-8')
  const expectedBuffer = Buffer.from(expectedSignature, 'utf-8')

  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    console.error('[Sentry Webhook] Firma sentry-hook-signature inválida')
    return res.status(401).send('Firma inválida')
  }

  // Responder 200 OK inmediatamente a Sentry
  res.status(200).send('OK')

  try {
    const payload = req.body
    
    // Extraer datos clave del webhook de Sentry
    const event = payload.data?.event || {}
    const issue = payload.data?.issue || {}
    
    const sentryId = event.event_id || event.id || null
    // Los webhooks de tipo "event_alert" (Alert Rule → Send a notification via
    // a webhook, que es el que vamos a usar) NO traen payload.data.issue —
    // el id del issue viene como event.issue_id. Solo los webhooks de tipo
    // "issue" (altas/bajas de estado, sin datos del evento) traen data.issue.
    // Cubrimos ambos casos por si en el futuro se agrega esa suscripción.
    const sentryIssueId = issue.id
      ? String(issue.id)
      : (event.issue_id ? String(event.issue_id) : null)
    const mensaje = issue.title || event.title || event.message || 'Error Desconocido'
    
    // Obtener el stacktrace si está formateado, o serializarlo
    let stack = ''
    if (event.exception?.values?.[0]) {
      const exc = event.exception.values[0]
      stack += `${exc.type}: ${exc.value}\n`
      if (exc.stacktrace?.frames) {
        stack += exc.stacktrace.frames
          .map(f => `  at ${f.function || '?'} (${f.filename || '?'}:${f.lineno || '?'})`)
          .reverse()
          .join('\n')
      }
    } else if (event.stacktrace) {
      stack = typeof event.stacktrace === 'string' ? event.stacktrace : JSON.stringify(event.stacktrace, null, 2)
    }

    // Extraer tenant_id desde los tags
    const tags = event.tags || []
    const tenantIdTag = tags.find(t => Array.isArray(t) && t[0] === 'tenant_id')
    const tenantId = tenantIdTag ? tenantIdTag[1] : null

    // Guardar en la base de datos
    await query(
      `INSERT INTO errores_sistema (sentry_id, sentry_issue_id, tenant_id, mensaje, stack, detalles)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (sentry_id) DO NOTHING`,
      [sentryId, sentryIssueId, tenantId, mensaje, stack, JSON.stringify(payload)]
    )

    if (sentryIssueId) {
      // Control de Frecuencia (Throttling) de 15 minutos por sentry_issue_id
      const { rows } = await query(
        `SELECT COUNT(*)::int AS count 
         FROM errores_sistema 
         WHERE sentry_issue_id = $1 
           AND creado_en >= NOW() - INTERVAL '15 minutes'
           AND sentry_id != $2`,
        [sentryIssueId, sentryId]
      )
      
      const recienteCount = rows[0]?.count || 0
      if (recienteCount === 0) {
        // No se ha notificado este bug en los últimos 15 min, enviar alerta por email
        await enviarEmailAlerta(sentryIssueId, mensaje, stack, tenantId)
      } else {
        console.log(`[Sentry Webhook] Throttling activo para issue ${sentryIssueId}. Alerta omitida.`)
      }
    } else {
      // Si por alguna razón no hay issue ID, mandamos alerta directa
      await enviarEmailAlerta('N/A', mensaje, stack, tenantId)
    }

  } catch (err) {
    console.error('[Sentry Webhook] Error al procesar payload de webhook:', err.message)
  }
})

export default router
