import { Router } from 'express'
import { query, transaction } from '../db/client.js'
import { requireAdminPin } from '../middleware/adminPinMiddleware.js'
import { requireAuth, requireRol } from '../middleware/authMiddleware.js'

const router = Router()
router.use(requireAuth)
// No lanza si falla — la auditoría nunca debe tumbar la escritura real.
// NOTA: valor_nuevo es NOT NULL en la tabla (pensada originalmente solo
// para precios) — para cambios de texto (nombre/categoría) se manda 0
// como relleno numérico; el dato real vive en valor_nuevo_texto.


async function registrarAuditoria(client, { tenantId, tipo, entidadId, entidadNombre, campo, valorAnterior, valorNuevo, valorAnteriorTexto, valorNuevoTexto, metodo, porcentaje, ip }) {
  try {
    await query(`
      INSERT INTO auditoria_precios
        (tenant_id, tipo, entidad_id, entidad_nombre, campo, valor_anterior, valor_nuevo, valor_anterior_texto, valor_nuevo_texto, metodo, porcentaje_aplicado, ip_origen)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    `, [tenantId, tipo, entidadId, entidadNombre, campo || 'precio', valorAnterior ?? null, valorNuevo ?? 0, valorAnteriorTexto || null, valorNuevoTexto || null, metodo, porcentaje || null, ip || null])
  } catch (e) {
    console.error('No se pudo registrar auditoría de cambio:', e.message)
  }
}
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
router.put('/masivo/lista', requireRol('admin'), requireAdminPin, async (req, res, next) => {
  const { productos = [] } = req.body
  if (!productos.length) return res.status(400).json({ error: 'Se requiere al menos un producto' })

  for (const p of productos) {
    const pr = parseFloat(p.precio)
    if (isNaN(pr) || pr <= 0) {
      return res.status(400).json({ error: 'Todos los productos deben tener un precio válido y mayor a cero' })
    }
  }

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
router.put('/masivo/categoria', requireRol('admin'), requireAdminPin, async (req, res, next) => {
  const { categoria, porcentaje } = req.body
  const pct = parseFloat(porcentaje)
  if (isNaN(pct)) {
    return res.status(400).json({ error: 'porcentaje debe ser un número válido' })
  }
  if (pct <= -100 || pct > 500) {
    return res.status(400).json({ error: 'Ajuste de porcentaje fuera de límites permitidos (-99% a +500%)' })
  }

  try {
    const factor = 1 + (pct / 100)

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
        if (nuevoPrecio <= 0) {
          throw new Error(`El ajuste resulta en un precio inválido (C$ ${nuevoPrecio}) para ${prod.nombre}`)
        }
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

router.put('/:id', requireRol('admin'), requireAdminPin, async (req, res, next) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(req.params.id)) {
    return res.status(400).json({ error: 'ID de producto inválido' })
  }

  const { precio, presentacion, nombre, categoria } = req.body

  if (precio !== undefined) {
    const pr = parseFloat(precio)
    if (isNaN(pr) || pr <= 0) {
      return res.status(400).json({ error: 'El precio debe ser un número válido y mayor a cero' })
    }
  }
  if (nombre !== undefined && !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre no puede estar vacío' })
  }
  if (categoria !== undefined && !categoria.trim()) {
    return res.status(400).json({ error: 'La categoría no puede estar vacía' })
  }

  try {
    const actualizado = await transaction(async (client) => {
      const { rows: anteriorRows } = await client.query(
        'SELECT precio, nombre, categoria, presentacion FROM productos WHERE id=$1 AND tenant_id=$2',
        [req.params.id, req.tenantId]
      )
      if (!anteriorRows.length) return null
      const anterior = anteriorRows[0]

      const nuevoNombre       = nombre       !== undefined ? nombre       : anterior.nombre
      const nuevaCategoria    = categoria    !== undefined ? categoria    : anterior.categoria
      const nuevoPrecio       = precio       !== undefined ? precio       : anterior.precio
      const nuevaPresentacion = presentacion !== undefined ? presentacion : anterior.presentacion

      const { rows } = await client.query(
        `UPDATE productos SET nombre=$1, categoria=$2, precio=$3, presentacion=$4, actualizado_en=NOW()
         WHERE id=$5 AND tenant_id=$6 RETURNING *`,
        [nuevoNombre, nuevaCategoria, nuevoPrecio, nuevaPresentacion, req.params.id, req.tenantId]
      )

      if (rows.length) {
        if (parseFloat(nuevoPrecio) !== parseFloat(anterior.precio)) {
          await registrarAuditoria(client, {
            tenantId: req.tenantId, tipo: 'producto', entidadId: req.params.id,
            entidadNombre: nuevoNombre, campo: 'precio',
            valorAnterior: anterior.precio, valorNuevo: nuevoPrecio,
            metodo: 'individual', ip: req.ip,
          })
        }
        if (nuevoNombre !== anterior.nombre) {
          await registrarAuditoria(client, {
            tenantId: req.tenantId, tipo: 'producto', entidadId: req.params.id,
            entidadNombre: nuevoNombre, campo: 'nombre',
            valorAnteriorTexto: anterior.nombre, valorNuevoTexto: nuevoNombre,
            metodo: 'individual', ip: req.ip,
          })
        }
        if (nuevaCategoria !== anterior.categoria) {
          await registrarAuditoria(client, {
            tenantId: req.tenantId, tipo: 'producto', entidadId: req.params.id,
            entidadNombre: nuevoNombre, campo: 'categoria',
            valorAnteriorTexto: anterior.categoria, valorNuevoTexto: nuevaCategoria,
            metodo: 'individual', ip: req.ip,
          })
        }
      }
      return rows[0] || null
    })

    if (!actualizado) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json(actualizado)
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un producto con ese nombre' })
    }
    next(e)
  }
})

export default router