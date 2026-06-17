import { Router } from 'express'
import { query, transaction } from '../db/client.js'
import { requireAdminPin } from '../middleware/adminPinMiddleware.js'

const router = Router()

// Helper: registra un cambio de precio en auditoria_precios.
// No lanza si falla — la auditoría nunca debe tumbar la escritura real.
async function registrarAuditoria(client, { tenantId, tipo, entidadId, entidadNombre, valorAnterior, valorNuevo, metodo, porcentaje, ip }) {
  try {
    await client.query(`
      INSERT INTO auditoria_precios
        (tenant_id, tipo, entidad_id, entidad_nombre, campo, valor_anterior, valor_nuevo, metodo, porcentaje_aplicado, ip_origen)
      VALUES ($1,'precio',$2,$3,'precio',$4,$5,$6,$7,$8)
    `, [tenantId, entidadId, entidadNombre, valorAnterior, valorNuevo, metodo, porcentaje || null, ip || null])
  } catch (e) {
    console.error('No se pudo registrar auditoría de precio:', e.message)
  }
}

// GET /api/catalogo — solo productos del tenant activo (lectura libre, sin PIN)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT p.*,
        CASE WHEN r.id IS NOT NULL THEN true ELSE false END AS tiene_receta
      FROM productos p
      LEFT JOIN recetas r ON r.producto = p.nombre AND r.tenant_id = p.tenant_id
      WHERE p.activo = true AND p.tenant_id = $1
      ORDER BY p.categoria, p.nombre
    `, [req.tenantId])
    res.json(rows)
  } catch (e) { next(e) }
})

// GET /api/catalogo/auditoria — historial de cambios de precio (lectura libre)
router.get('/auditoria', async (req, res, next) => {
  try {
    const { limit = 50 } = req.query
    const { rows } = await query(`
      SELECT * FROM auditoria_precios
      WHERE tenant_id = $1 AND tipo = 'producto'
      ORDER BY creado_en DESC
      LIMIT $2
    `, [req.tenantId, parseInt(limit)])
    res.json(rows)
  } catch (e) { next(e) }
})

// ── Rutas de escritura — protegidas con PIN de Admin ──────────────────────
// IMPORTANTE: las rutas masivas van antes de /:id, si no Express toma
// "masivo" como si fuera el parámetro :id.

// PUT /api/catalogo/masivo/lista — edición masiva: lista explícita de {id, precio}
router.put('/masivo/lista', requireAdminPin, async (req, res, next) => {
  const { productos = [] } = req.body
  if (!productos.length) return res.status(400).json({ error: 'Se requiere al menos un producto' })

  try {
    const actualizados = await transaction(async (client) => {
      const resultados = []
      for (const p of productos) {
        const { rows: anteriorRows } = await client.query(
          'SELECT precio, nombre FROM productos WHERE id=$1 AND tenant_id=$2',
          [p.id, req.tenantId]
        )
        if (!anteriorRows.length) continue
        const anterior = anteriorRows[0]

        const { rows } = await client.query(
          `UPDATE productos SET precio=$1, actualizado_en=NOW()
           WHERE id=$2 AND tenant_id=$3 RETURNING *`,
          [p.precio, p.id, req.tenantId]
        )
        if (rows.length) {
          resultados.push(rows[0])
          await registrarAuditoria(client, {
            tenantId: req.tenantId, tipo: 'producto', entidadId: p.id,
            entidadNombre: anterior.nombre, valorAnterior: anterior.precio,
            valorNuevo: p.precio, metodo: 'masivo_lista', ip: req.ip,
          })
        }
      }
      return resultados
    })
    res.json({ actualizados: actualizados.length, productos: actualizados })
  } catch (e) { next(e) }
})

// PUT /api/catalogo/masivo/categoria — ajuste por porcentaje a toda una categoría
router.put('/masivo/categoria', requireAdminPin, async (req, res, next) => {
  const { categoria, porcentaje } = req.body
  if (porcentaje === undefined || porcentaje === null) {
    return res.status(400).json({ error: 'porcentaje es requerido' })
  }

  try {
    const factor = 1 + (parseFloat(porcentaje) / 100)

    const actualizados = await transaction(async (client) => {
      const params = [req.tenantId]
      let where = 'WHERE tenant_id = $1'
      if (categoria && categoria !== 'Todos') {
        params.push(categoria)
        where += ' AND categoria = $2'
      }

      const { rows: afectados } = await client.query(
        `SELECT id, nombre, precio FROM productos ${where}`, params
      )

      const resultados = []
      for (const prod of afectados) {
        const nuevoPrecio = Math.round(prod.precio * factor * 100) / 100
        await client.query(
          'UPDATE productos SET precio=$1, actualizado_en=NOW() WHERE id=$2',
          [nuevoPrecio, prod.id]
        )
        await registrarAuditoria(client, {
          tenantId: req.tenantId, tipo: 'producto', entidadId: prod.id,
          entidadNombre: prod.nombre, valorAnterior: prod.precio,
          valorNuevo: nuevoPrecio, metodo: 'masivo_porcentaje',
          porcentaje: parseFloat(porcentaje), ip: req.ip,
        })
        resultados.push({ id: prod.id, nombre: prod.nombre, precio: nuevoPrecio })
      }
      return resultados
    })

    res.json({ actualizados: actualizados.length, factor_aplicado: factor, productos: actualizados })
  } catch (e) { next(e) }
})

// PUT /api/catalogo/:id — actualizar un producto individual
router.put('/:id', requireAdminPin, async (req, res, next) => {
  const { precio, presentacion } = req.body
  try {
    const actualizado = await transaction(async (client) => {
      const { rows: anteriorRows } = await client.query(
        'SELECT precio, nombre FROM productos WHERE id=$1 AND tenant_id=$2',
        [req.params.id, req.tenantId]
      )
      if (!anteriorRows.length) return null
      const anterior = anteriorRows[0]

      const { rows } = await client.query(
        `UPDATE productos SET precio=$1, presentacion=$2, actualizado_en=NOW()
         WHERE id=$3 AND tenant_id=$4 RETURNING *`,
        [precio, presentacion, req.params.id, req.tenantId]
      )

      if (rows.length && parseFloat(precio) !== parseFloat(anterior.precio)) {
        await registrarAuditoria(client, {
          tenantId: req.tenantId, tipo: 'producto', entidadId: req.params.id,
          entidadNombre: anterior.nombre, valorAnterior: anterior.precio,
          valorNuevo: precio, metodo: 'individual', ip: req.ip,
        })
      }
      return rows[0] || null
    })

    if (!actualizado) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json(actualizado)
  } catch (e) { next(e) }
})

export default router
