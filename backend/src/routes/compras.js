import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import { query, transaction } from '../db/client.js'

const router = Router()
router.use(requireAuth)

// GET /api/compras
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT f.*,
        json_agg(json_build_object(
          'id', fi.id, 'producto', fi.producto, 'cantidad', fi.cantidad,
          'precio_actual', fi.precio_actual, 'precio_anterior', fi.precio_anterior,
          'variacion_pct', fi.variacion_pct, 'alerta', fi.alerta
        )) AS items
      FROM facturas f
      LEFT JOIN factura_items fi ON fi.factura_id = f.id AND fi.tenant_id = f.tenant_id
      WHERE f.tenant_id = $1
      GROUP BY f.id
      ORDER BY f.fecha DESC, f.creado_en DESC
      LIMIT 100
    `, [req.tenantId])
    res.json(rows)
  } catch (e) { next(e) }
})

// POST /api/compras
router.post('/', async (req, res, next) => {
  const { proveedor, fecha, items = [], notas } = req.body
  const tenantId = req.tenantId
  if (!items.length) return res.status(400).json({ error: 'items es requerido' })

  try {
    const factura = await transaction(async (client) => {
      const total = items.reduce((s, i) => s + (i.cantidad || 1) * (i.precio_actual || 0), 0)
      const { rows: [f] } = await client.query(`
        INSERT INTO facturas (tenant_id, proveedor, fecha, total, notas)
        VALUES ($1, $2, $3, $4, $5) RETURNING *
      `, [tenantId, proveedor || 'Sin nombre', fecha || new Date().toISOString().split('T')[0], total, notas || ''])

      for (const item of items) {
        const variacion = item.precio_anterior > 0
          ? ((item.precio_actual - item.precio_anterior) / item.precio_anterior) * 100
          : null
        const alerta = variacion !== null && variacion > 10

        await client.query(`
          INSERT INTO factura_items
            (tenant_id, factura_id, producto, cantidad, precio_actual, precio_anterior, variacion_pct, alerta)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `, [tenantId, f.id, item.producto, item.cantidad || 1,
            item.precio_actual || 0, item.precio_anterior || 0,
            variacion ? parseFloat(variacion.toFixed(2)) : null, alerta])
      }
      // Actualizar inventario con los items de la factura
      for (const item of items) {
        if (!item.producto || !item.precio_actual) continue
        const nombreNorm = item.producto.toLowerCase().trim()
        // Buscar insumo por nombre similar
        const { rows: insumos } = await client.query(`
          SELECT id, nombre FROM inventario
          WHERE tenant_id = $1 AND LOWER(nombre) LIKE $2
          LIMIT 1
        `, [tenantId, '%' + nombreNorm.substring(0, 6) + '%'])

        if (insumos.length > 0) {
          await client.query(`
            UPDATE inventario
            SET existencia = existencia + $1,
                costo_unitario = $2
            WHERE id = $3 AND tenant_id = $4
          `, [item.cantidad || 1, item.precio_actual, insumos[0].id, tenantId])
        } else {
          await client.query(`
            INSERT INTO inventario (tenant_id, nombre, existencia, unidad, costo_unitario, consumo_diario, punto_reposicion)
            VALUES ($1, $2, $3, 'unidad', $4, 0, 0)
          `, [tenantId, item.producto, item.cantidad || 1, item.precio_actual || 0])
        }
      }

      return f
    })

    const { rows } = await query(`
      SELECT f.*, json_agg(json_build_object(
        'producto', fi.producto, 'cantidad', fi.cantidad,
        'precio_actual', fi.precio_actual, 'variacion_pct', fi.variacion_pct, 'alerta', fi.alerta
      )) AS items
      FROM facturas f
      LEFT JOIN factura_items fi ON fi.factura_id = f.id AND fi.tenant_id = f.tenant_id
      WHERE f.id = $1 AND f.tenant_id = $2 GROUP BY f.id
    `, [factura.id, tenantId])

    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})


// POST /api/compras/escanear — extrae datos de factura con IA (imagen base64)
router.post('/escanear', async (req, res, next) => {
  const { imagen, mediaType = 'image/jpeg' } = req.body
  if (!imagen) return res.status(400).json({ error: 'imagen en base64 es requerida' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type:   'image',
              source: { type: 'base64', media_type: mediaType, data: imagen }
            },
            {
              type: 'text',
              text: `Analiza esta factura de compra de una panadería nicaragüense y extrae los datos en JSON.
Las unidades pueden ser: arroba, libra, quintal, kg, g, litro, unidad, docena, bolsa, saco.
Responde SOLO con JSON válido, sin texto adicional ni backticks:
{
  "proveedor": "nombre del proveedor o empresa",
  "fecha": "YYYY-MM-DD o null si no se ve",
  "items": [
    {
      "producto": "nombre del producto",
      "cantidad": número,
      "unidad": "arroba|libra|kg|quintal|litro|unidad|etc",
      "precio_actual": número (precio unitario en córdobas, sin símbolos)
    }
  ]
}
Si no puedes leer algún campo con certeza, usa null.`
            }
          ]
        }]
      })
    })

    const data = await response.json()
    if (data.error) return res.status(502).json({ error: data.error.message })

    const texto = data.content?.[0]?.text || ''
    const parsed = JSON.parse(texto.replace(/\`\`\`json|\`\`\`/g, '').trim())
    res.json(parsed)
  } catch (e) {
    next(e)
  }
})

export default router
