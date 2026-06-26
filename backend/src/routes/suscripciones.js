import { Router } from 'express'
import { query, transaction } from '../db/client.js'
import crypto from 'crypto'

const router = Router()

// GET /api/suscripciones/mi-plan — estado actual del tenant
router.get('/mi-plan', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT s.*,
        CASE
          WHEN s.estado = 'trial' AND now() > s.fin_trial THEN 'trial_vencido'
          WHEN s.estado = 'activo' AND now() > s.fin_pago THEN 'pago_vencido'
          ELSE s.estado
        END AS estado_real,
        EXTRACT(DAY FROM (
          CASE WHEN s.estado = 'trial' THEN s.fin_trial ELSE s.fin_pago END
        ) - now()) AS dias_restantes
      FROM suscripciones s
      WHERE s.tenant_id = $1
      ORDER BY s.creado_en DESC
      LIMIT 1
    `, [req.tenantId])

    if (!rows[0]) return res.status(404).json({ error: 'Suscripcion no encontrada' })
    res.json(rows[0])
  } catch (e) { next(e) }
})

// GET /api/suscripciones/datos-pago — datos bancarios LAFISE
router.get('/datos-pago', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT s.id as suscripcion_id, s.monto_mensual, s.plan,
        EXTRACT(DAY FROM (
          CASE WHEN s.estado = 'trial' THEN s.fin_trial ELSE s.fin_pago END
        ) - now()) AS dias_restantes
      FROM suscripciones s
      WHERE s.tenant_id = $1
      ORDER BY s.creado_en DESC LIMIT 1
    `, [req.tenantId])

    if (!rows[0]) return res.status(404).json({ error: 'Suscripcion no encontrada' })

    // Referencia única: MB-TENANTID(8chars)-TIMESTAMP
    const ref = 'MB-' + req.tenantId.replace(/-/g,'').substring(0,8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase()

    res.json({
      ...rows[0],
      banco: 'LAFISE BANCENTRO',
      cuenta: '100-302941-8',
      tipo_cuenta: 'Cuenta Corriente Córdobas',
      beneficiario: 'Leiva Cruz Developments',
      referencia: ref,
      monto_usd: rows[0].monto_mensual,
      instrucciones: [
        'Transferir exactamente U$' + rows[0].monto_mensual + ' a la cuenta indicada',
        'Incluir la referencia ' + ref + ' en la descripcion de la transferencia',
        'Subir el comprobante en esta pantalla',
        'Esperar confirmacion en menos de 24 horas'
      ]
    })
  } catch (e) { next(e) }
})

// POST /api/suscripciones/pago — subir comprobante
router.post('/pago', async (req, res, next) => {
  const { suscripcion_id, referencia, comprobante_url, monto, notas } = req.body

  if (!suscripcion_id || !referencia || !comprobante_url || !monto) {
    return res.status(400).json({ error: 'suscripcion_id, referencia, comprobante_url y monto son requeridos' })
  }

  try {
    // Verificar que la suscripcion pertenece al tenant
    const { rows: subs } = await query(
      'SELECT id, estado FROM suscripciones WHERE id = $1 AND tenant_id = $2',
      [suscripcion_id, req.tenantId]
    )
    if (!subs[0]) return res.status(404).json({ error: 'Suscripcion no encontrada' })

    // Verificar intentos previos
    const { rows: intentos } = await query(
      'SELECT COUNT(*) as total FROM pagos WHERE suscripcion_id = $1 AND estado = $2',
      [suscripcion_id, 'pendiente']
    )
    if (parseInt(intentos[0].total) >= 3) {
      return res.status(429).json({ error: 'Maximo 3 comprobantes por ciclo. Contacta a soporte.' })
    }

    // Hash del comprobante para detectar duplicados
    const hash = crypto.createHash('sha256').update(comprobante_url).digest('hex')

    const { rows } = await query(`
      INSERT INTO pagos (tenant_id, suscripcion_id, monto, referencia, comprobante_url, comprobante_hash, fecha_subida, notas)
      VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
      RETURNING *
    `, [req.tenantId, suscripcion_id, monto, referencia, comprobante_url, hash, notas || ''])

    // Log de auditoría
    await query(`
      INSERT INTO pagos_auditoria (pago_id, tenant_id, accion, estado_nuevo, realizado_por, ip)
      VALUES ($1, $2, 'comprobante_subido', 'pendiente', $3, $4)
    `, [rows[0].id, req.tenantId, req.email, req.ip])

    res.status(201).json({
      ok: true,
      pago_id: rows[0].id,
      mensaje: 'Comprobante recibido. Te notificaremos en menos de 24 horas.'
    })
  } catch (e) {
    if (e.message?.includes('duplicado')) {
      return res.status(409).json({ error: 'Este comprobante ya fue subido anteriormente.' })
    }
    next(e)
  }
})

// POST /api/suscripciones/aprobar/:pagoId — SOLO super admin (Mario)
router.post('/aprobar/:pagoId', async (req, res, next) => {
  if (req.email !== 'admin@marquez.com' && req.rol !== 'superadmin') {
    return res.status(403).json({ error: 'No autorizado' })
  }

  const { pagoId } = req.params
  const { notas } = req.body

  try {
    const result = await transaction(async (client) => {
      // Obtener pago
      const { rows: pagos } = await client.query(
        'SELECT * FROM pagos WHERE id = $1 AND estado = $2',
        [pagoId, 'pendiente']
      )
      if (!pagos[0]) throw { status: 404, message: 'Pago no encontrado o ya procesado' }

      const pago = pagos[0]

      // Aprobar pago
      await client.query(`
        UPDATE pagos SET estado = 'aprobado', aprobado_en = now(),
          aprobado_por = $1, ip_aprobacion = $2, notas = $3
        WHERE id = $4
      `, [req.email, req.ip, notas || '', pagoId])

      // Activar suscripción desde fecha_subida del comprobante
      await client.query(`
        UPDATE suscripciones SET
          estado = 'activo',
          inicio_pago = $1,
          fin_pago = $1 + interval '30 days'
        WHERE id = $2
      `, [pago.fecha_subida, pago.suscripcion_id])

      // Log de auditoría
      await client.query(`
        INSERT INTO pagos_auditoria (pago_id, tenant_id, accion, estado_anterior, estado_nuevo, realizado_por, ip, notas)
        VALUES ($1, $2, 'pago_aprobado', 'pendiente', 'aprobado', $3, $4, $5)
      `, [pagoId, pago.tenant_id, req.email, req.ip, notas || ''])

      return pago
    })

    res.json({ ok: true, mensaje: 'Pago aprobado. Suscripcion activada por 30 dias.' })
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message })
    next(e)
  }
})

// POST /api/suscripciones/rechazar/:pagoId
router.post('/rechazar/:pagoId', async (req, res, next) => {
  if (req.email !== 'admin@marquez.com' && req.rol !== 'superadmin') {
    return res.status(403).json({ error: 'No autorizado' })
  }

  const { pagoId } = req.params
  const { motivo } = req.body

  try {
    const { rows } = await query(
      'UPDATE pagos SET estado = $1, aprobado_por = $2, notas = $3 WHERE id = $4 AND estado = $5 RETURNING *',
      ['rechazado', req.email, motivo || '', pagoId, 'pendiente']
    )
    if (!rows[0]) return res.status(404).json({ error: 'Pago no encontrado' })

    await query(`
      INSERT INTO pagos_auditoria (pago_id, tenant_id, accion, estado_anterior, estado_nuevo, realizado_por, ip, notas)
      VALUES ($1, $2, 'pago_rechazado', 'pendiente', 'rechazado', $3, $4, $5)
    `, [pagoId, rows[0].tenant_id, req.email, req.ip, motivo || ''])

    res.json({ ok: true, mensaje: 'Pago rechazado.' })
  } catch (e) { next(e) }
})

// GET /api/suscripciones/admin/pendientes — panel Mario
router.get('/admin/pendientes', async (req, res, next) => {
  if (req.email !== 'admin@marquez.com' && req.rol !== 'superadmin') {
    return res.status(403).json({ error: 'No autorizado' })
  }
  try {
    const { rows } = await query(`
      SELECT p.*, t.nombre_negocio, s.plan, s.monto_mensual
      FROM pagos p
      JOIN tenants t ON t.id = p.tenant_id
      JOIN suscripciones s ON s.id = p.suscripcion_id
      WHERE p.estado = 'pendiente'
      ORDER BY p.fecha_subida ASC
    `, [])
    res.json(rows)
  } catch (e) { next(e) }
})

export default router
