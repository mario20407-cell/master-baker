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

        // 1. Obtener costo anterior (si el insumo existe)
        const { rows: invRows } = await client.query(
          'SELECT id, costo_unitario FROM inventario WHERE tenant_id = $1 AND nombre = $2',
          [tenantId, item.producto.trim()]
        )
        
        let invId = null
        let costoAnterior = null
        if (invRows.length) {
          invId = invRows[0].id
          costoAnterior = parseFloat(invRows[0].costo_unitario) || 0
        }

        // 2. Insertar o actualizar stock y costo en inventario (upsert)
        const { rows: upsertRows } = await client.query(`
          INSERT INTO inventario (tenant_id, nombre, existencia, unidad, costo_unitario)
          VALUES ($1, $2, $3, 'kg', $4)
          ON CONFLICT (tenant_id, nombre)
          DO UPDATE SET 
            existencia = inventario.existencia + EXCLUDED.existencia,
            costo_unitario = EXCLUDED.costo_unitario,
            actualizado_en = NOW()
          RETURNING id, costo_unitario
        `, [tenantId, item.producto.trim(), item.cantidad || 0, item.precio_actual || 0])
        
        const nuevoInsumo = upsertRows[0]

        // 3. Si hubo cambio de precio, registrar auditoría
        if (costoAnterior !== null && costoAnterior !== (item.precio_actual || 0)) {
          await client.query(`
            INSERT INTO auditoria_precios
              (tenant_id, tipo, entidad_id, entidad_nombre, campo, valor_anterior, valor_nuevo, metodo, ip_origen)
            VALUES ($1, 'insumo', $2, $3, 'costo_unitario', $4, $5, 'compras', $6)
          `, [tenantId, nuevoInsumo.id, item.producto.trim(), costoAnterior, item.precio_actual || 0, req.ip || null])
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

export default router
