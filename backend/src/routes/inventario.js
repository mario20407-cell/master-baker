import { Router } from 'express'
import { query, transaction } from '../db/client.js'
import { requireAdminPin } from '../middleware/adminPinMiddleware.js'
import { requireAuth, requireRol } from '../middleware/authMiddleware.js'

const router = Router()

router.use(requireAuth)

async function registrarAuditoria(client, { tenantId, entidadId, entidadNombre, valorAnterior, valorNuevo, metodo, porcentaje, ip }) {
  try {
    await client.query(`
      INSERT INTO auditoria_precios
        (tenant_id, tipo, entidad_id, entidad_nombre, campo, valor_anterior, valor_nuevo, metodo, porcentaje_aplicado, ip_origen)
      VALUES ($1,'insumo',$2,$3,'costo_unitario',$4,$5,$6,$7,$8)
    `, [tenantId, entidadId, entidadNombre, valorAnterior, valorNuevo, metodo, porcentaje || null, ip || null])
  } catch (e) {
    console.error('No se pudo registrar auditoría de costo:', e.message)
  }
}

// GET /api/inventario — lectura libre, sin PIN
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT *,
        CASE WHEN consumo_diario > 0
          THEN FLOOR(existencia / consumo_diario)
          ELSE NULL
        END AS dias_restantes,
        CASE
          WHEN consumo_diario > 0 AND FLOOR(existencia / consumo_diario) <= 3 THEN 'critico'
          WHEN consumo_diario > 0 AND FLOOR(existencia / consumo_diario) <= 7 THEN 'bajo'
          ELSE 'normal'
        END AS estado
      FROM inventario
      WHERE tenant_id = $1
      ORDER BY nombre
    `, [req.tenantId])
    res.json(rows)
  } catch (e) { next(e) }
})

// GET /api/inventario/auditoria — historial de cambios de costo (lectura libre)
router.get('/auditoria', async (req, res, next) => {
  try {
    const { limit = 50 } = req.query
    const { rows } = await query(`
      SELECT * FROM auditoria_precios
      WHERE tenant_id = $1 AND tipo = 'insumo'
      ORDER BY creado_en DESC
      LIMIT $2
    `, [req.tenantId, parseInt(limit)])
    res.json(rows)
  } catch (e) { next(e) }
})

// POST /api/inventario — crear insumo nuevo (sin PIN: agregar es distinto a editar precio existente)
router.post('/', async (req, res, next) => {
  const { nombre, existencia, unidad, consumo_diario, punto_reposicion, costo_unitario } = req.body
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' })

  const ALLOWED_UNITS = ['kg', 'g', 'l', 'ml', 'unidad', 'libra', 'arroba', 'docena', 'caja', 'bolsa']
  if (unidad && !ALLOWED_UNITS.includes(unidad.toLowerCase())) {
    return res.status(400).json({ error: `Unidad inválida. Permitidas: ${ALLOWED_UNITS.join(', ')}` })
  }
  if (costo_unitario !== undefined) {
    const cu = parseFloat(costo_unitario)
    if (isNaN(cu) || cu < 0 || cu > 1000000) {
      return res.status(400).json({ error: 'El costo unitario debe ser un número válido, no negativo y menor a 1,000,000' })
    }
  }
  if (existencia !== undefined && (isNaN(parseFloat(existencia)) || parseFloat(existencia) < 0 || parseFloat(existencia) > 1000000)) {
    return res.status(400).json({ error: 'La existencia debe ser un número válido, no negativo y menor a 1,000,000' })
  }
  if (consumo_diario !== undefined && (isNaN(parseFloat(consumo_diario)) || parseFloat(consumo_diario) < 0 || parseFloat(consumo_diario) > 1000000)) {
    return res.status(400).json({ error: 'El consumo diario debe ser un número válido, no negativo y menor a 1,000,000' })
  }
  if (punto_reposicion !== undefined && (isNaN(parseFloat(punto_reposicion)) || parseFloat(punto_reposicion) < 0 || parseFloat(punto_reposicion) > 1000000)) {
    return res.status(400).json({ error: 'El punto de reposición debe ser un número válido, no negativo y menor a 1,000,000' })
  }

  try {
    const { rows } = await query(`
      INSERT INTO inventario (tenant_id, nombre, existencia, unidad, consumo_diario, punto_reposicion, costo_unitario)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (tenant_id, nombre) DO UPDATE SET
        existencia=EXCLUDED.existencia, unidad=EXCLUDED.unidad,
        consumo_diario=EXCLUDED.consumo_diario, punto_reposicion=EXCLUDED.punto_reposicion,
        costo_unitario=EXCLUDED.costo_unitario, actualizado_en=NOW()
      RETURNING *
    `, [req.tenantId, nombre, existencia || 0, unidad || 'kg',
        consumo_diario || 0, punto_reposicion || 0, costo_unitario || 0])
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

// ── Rutas masivas — protegidas con PIN, antes de /:id ──────────────────────

router.put('/masivo/lista', requireRol('admin'), requireAdminPin, async (req, res, next) => {
  const { insumos = [] } = req.body
  if (!insumos.length) return res.status(400).json({ error: 'Se requiere al menos un insumo' })

  for (const i of insumos) {
    const cu = parseFloat(i.costo_unitario)
    if (isNaN(cu) || cu < 0 || cu > 1000000) {
      return res.status(400).json({ error: 'Todos los insumos deben tener un costo unitario válido (no negativo y menor a 1,000,000)' })
    }
  }

  try {
    const actualizados = await transaction(async (client) => {
      const resultados = []
      for (const i of insumos) {
        const { rows: anteriorRows } = await client.query(
          'SELECT costo_unitario, nombre FROM inventario WHERE id=$1 AND tenant_id=$2',
          [i.id, req.tenantId]
        )
        if (!anteriorRows.length) continue
        const anterior = anteriorRows[0]

        const { rows } = await client.query(
          `UPDATE inventario SET costo_unitario=$1, actualizado_en=NOW()
           WHERE id=$2 AND tenant_id=$3 RETURNING *`,
          [i.costo_unitario, i.id, req.tenantId]
        )
        if (rows.length) {
          resultados.push(rows[0])
          await registrarAuditoria(client, {
            tenantId: req.tenantId, entidadId: i.id, entidadNombre: anterior.nombre,
            valorAnterior: anterior.costo_unitario, valorNuevo: i.costo_unitario,
            metodo: 'masivo_lista', ip: req.ip,
          })
        }
      }
      return resultados
    })
    res.json({ actualizados: actualizados.length, insumos: actualizados })
  } catch (e) { next(e) }
})

router.put('/masivo/porcentaje', requireRol('admin'), requireAdminPin, async (req, res, next) => {
  const { porcentaje } = req.body
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
      const { rows: afectados } = await client.query(
        'SELECT id, nombre, costo_unitario FROM inventario WHERE tenant_id = $1', [req.tenantId]
      )
      const resultados = []
      for (const ins of afectados) {
        const nuevoCosto = Math.round(ins.costo_unitario * factor * 10000) / 10000
        if (nuevoCosto < 0) {
          throw new Error(`El ajuste resulta en un costo inválido (C$ ${nuevoCosto}) para ${ins.nombre}`)
        }
        await client.query(
          'UPDATE inventario SET costo_unitario=$1, actualizado_en=NOW() WHERE id=$2',
          [nuevoCosto, ins.id]
        )
        await registrarAuditoria(client, {
          tenantId: req.tenantId, entidadId: ins.id, entidadNombre: ins.nombre,
          valorAnterior: ins.costo_unitario, valorNuevo: nuevoCosto,
          metodo: 'masivo_porcentaje', porcentaje: pct, ip: req.ip,
        })
        resultados.push({ id: ins.id, nombre: ins.nombre, costo_unitario: nuevoCosto })
      }
      return resultados
    })

    res.json({ actualizados: actualizados.length, factor_aplicado: factor, insumos: actualizados })
  } catch (e) { next(e) }
})

// PUT /api/inventario/:id — editar insumo individual (protegido con PIN solo si cambia el costo)
router.put('/:id', requireRol('admin'), requireAdminPin, async (req, res, next) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(req.params.id)) {
    return res.status(400).json({ error: 'ID de insumo inválido' })
  }

  const { existencia, consumo_diario, punto_reposicion, costo_unitario } = req.body

  if (costo_unitario !== undefined) {
    const cu = parseFloat(costo_unitario)
    if (isNaN(cu) || cu < 0 || cu > 1000000) {
      return res.status(400).json({ error: 'El costo unitario debe ser un número válido, no negativo y menor a 1,000,000' })
    }
  }
  if (existencia !== undefined && (isNaN(parseFloat(existencia)) || parseFloat(existencia) < 0 || parseFloat(existencia) > 1000000)) {
    return res.status(400).json({ error: 'La existencia debe ser un número válido, no negativo y menor a 1,000,000' })
  }
  if (consumo_diario !== undefined && (isNaN(parseFloat(consumo_diario)) || parseFloat(consumo_diario) < 0 || parseFloat(consumo_diario) > 1000000)) {
    return res.status(400).json({ error: 'El consumo diario debe ser un número válido, no negativo y menor a 1,000,000' })
  }
  if (punto_reposicion !== undefined && (isNaN(parseFloat(punto_reposicion)) || parseFloat(punto_reposicion) < 0 || parseFloat(punto_reposicion) > 1000000)) {
    return res.status(400).json({ error: 'El punto de reposición debe ser un número válido, no negativo y menor a 1,000,000' })
  }

  try {
    const actualizado = await transaction(async (client) => {
      const { rows: anteriorRows } = await client.query(
        'SELECT costo_unitario, nombre FROM inventario WHERE id=$1 AND tenant_id=$2',
        [req.params.id, req.tenantId]
      )
      if (!anteriorRows.length) return null
      const anterior = anteriorRows[0]

      const { rows } = await client.query(`
        UPDATE inventario SET existencia=$1, consumo_diario=$2,
          punto_reposicion=$3, costo_unitario=$4, actualizado_en=NOW()
        WHERE id=$5 AND tenant_id=$6 RETURNING *
      `, [existencia, consumo_diario, punto_reposicion, costo_unitario, req.params.id, req.tenantId])

      if (rows.length && parseFloat(costo_unitario) !== parseFloat(anterior.costo_unitario)) {
        await registrarAuditoria(client, {
          tenantId: req.tenantId, entidadId: req.params.id, entidadNombre: anterior.nombre,
          valorAnterior: anterior.costo_unitario, valorNuevo: costo_unitario,
          metodo: 'individual', ip: req.ip,
        })
      }
      return rows[0] || null
    })

    if (!actualizado) return res.status(404).json({ error: 'Insumo no encontrado' })
    res.json(actualizado)
  } catch (e) { next(e) }
})

// DELETE /api/inventario/:id — sin PIN (eliminar no es "editar precio")
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM inventario WHERE id=$1 AND tenant_id=$2', [req.params.id, req.tenantId])
    if (!rowCount) return res.status(404).json({ error: 'Insumo no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
})

export default router
