import { query } from '../db/client.js'

const WA_API = () => `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`

async function enviarWA(telefono, mensaje) {
  const token = process.env.WHATSAPP_TOKEN
  if (!token || !process.env.WHATSAPP_PHONE_ID) return
  const numero = telefono.replace(/\D/g, '')
  if (!numero) return
  try {
    await fetch(WA_API(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numero,
        type: 'text',
        text: { body: mensaje },
      }),
    })
  } catch (e) {
    console.error('[Alertas] Error enviando WA a', numero, e.message)
  }
}

export async function checkStockTerminado(tenantId) {
  const { rows: config } = await query(
    'SELECT whatsapp_taller, whatsapp_jefe_operaciones FROM tenants WHERE id = $1',
    [tenantId]
  )
  if (!config.length) return
  const { whatsapp_taller, whatsapp_jefe_operaciones } = config[0]
  if (!whatsapp_taller && !whatsapp_jefe_operaciones) return

  const { rows } = await query(
    `SELECT it.id, it.producto, it.stock, it.unidad, s.nombre AS sucursal
     FROM inventario_terminado it
     JOIN sucursales s ON s.id = it.sucursal_id
     WHERE it.tenant_id = $1
       AND it.stock_minimo > 0
       AND it.stock <= it.stock_minimo
       AND (it.alerta_enviada_en IS NULL OR it.alerta_enviada_en < NOW() - INTERVAL '2 hours')`,
    [tenantId]
  )

  for (const row of rows) {
    const msg = `🍞 Master Baker — ${row.sucursal}: solo quedan ${row.stock} ${row.unidad} de ${row.producto}. Preparar nueva hornada.`
    const destinatarios = [...new Set([whatsapp_taller, whatsapp_jefe_operaciones].filter(Boolean))]
    for (const num of destinatarios) await enviarWA(num, msg)
    await query('UPDATE inventario_terminado SET alerta_enviada_en = NOW() WHERE id = $1', [row.id])
    console.log(`[Alertas] Stock bajo enviado: ${row.producto} (${row.sucursal})`)
  }
}

export async function checkInventarioInsumos(tenantId) {
  const { rows: config } = await query(
    'SELECT whatsapp_compras, whatsapp_jefe_operaciones FROM tenants WHERE id = $1',
    [tenantId]
  )
  if (!config.length) return
  const { whatsapp_compras, whatsapp_jefe_operaciones } = config[0]
  if (!whatsapp_compras && !whatsapp_jefe_operaciones) return

  const { rows } = await query(
    `SELECT id, nombre, existencia, unidad, punto_reposicion
     FROM inventario
     WHERE tenant_id = $1
       AND punto_reposicion > 0
       AND existencia <= punto_reposicion
       AND (alerta_enviada_en IS NULL OR alerta_enviada_en < NOW() - INTERVAL '2 hours')`,
    [tenantId]
  )

  for (const row of rows) {
    const msg = `🛒 Master Baker — ${row.nombre} bajo el mínimo: quedan ${row.existencia}${row.unidad}. Hacer pedido.`
    const destinatarios = [...new Set([whatsapp_compras, whatsapp_jefe_operaciones].filter(Boolean))]
    for (const num of destinatarios) await enviarWA(num, msg)
    await query('UPDATE inventario SET alerta_enviada_en = NOW() WHERE id = $1', [row.id])
    console.log(`[Alertas] Insumo bajo enviado: ${row.nombre}`)
  }
}
