import { Router } from 'express'
import { query, transaction } from '../db/client.js'
import { requireAdminPin } from '../middleware/adminPinMiddleware.js'
import { requireAuth, requireRol } from '../middleware/authMiddleware.js'
import { normalizarInsumo } from '../utils/normalizarInsumo.js'

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

// GET /api/inventario — lectura libre, sin PIN, filtrando activos
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
      WHERE tenant_id = $1 AND activo = true
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

// POST /api/inventario — crear/actualizar insumo normalizado
router.post('/', async (req, res, next) => {
  const { nombre, existencia, unidad, consumo_diario, punto_reposicion, costo_unitario, densidad_g_ml } = req.body
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' })

  // Normalizar a unidad base
  const norm = normalizarInsumo({ nombre, existencia, unidad, consumo_diario, punto_reposicion, costo_unitario })

  try {
    const { rows } = await query(`
      INSERT INTO inventario (tenant_id, nombre, existencia, unidad, consumo_diario, punto_reposicion, costo_unitario, densidad_g_ml, activo)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
      ON CONFLICT (tenant_id, lower(trim(regexp_replace(nombre, '\\s+', ' ', 'g')))) 
      DO UPDATE SET
        existencia = EXCLUDED.existencia, 
        unidad = EXCLUDED.unidad,
        consumo_diario = EXCLUDED.consumo_diario, 
        punto_reposicion = EXCLUDED.punto_reposicion,
        costo_unitario = EXCLUDED.costo_unitario, 
        densidad_g_ml = COALESCE(EXCLUDED.densidad_g_ml, inventario.densidad_g_ml),
        activo = true,
        actualizado_en = NOW()
      RETURNING *
    `, [req.tenantId, norm.nombre, norm.existencia, norm.unidad,
        norm.consumo_diario, norm.punto_reposicion, norm.costo_unitario, densidad_g_ml ? parseFloat(densidad_g_ml) : null])
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

// PUT /api/inventario/masivo/lista — ajuste masivo de costos
router.put('/masivo/lista', requireRol('admin'), requireAdminPin, async (req, res, next) => {
  const { insumos = [] } = req.body
  if (!insumos.length) return res.status(400).json({ error: 'Se requiere al menos un insumo' })

  try {
    const actualizados = await transaction(async (client) => {
      const resultados = []
      for (const i of insumos) {
        const { rows: anteriorRows } = await client.query(
          'SELECT costo_unitario, nombre, unidad FROM inventario WHERE id=$1 AND tenant_id=$2',
          [i.id, req.tenantId]
        )
        if (!anteriorRows.length) continue
        const anterior = anteriorRows[0]

        // El costo unitario masivo ingresado se normaliza si la unidad del inventario es diferente
        // (pero asumimos que la lista masiva viene ya en la unidad base o se pasa directo)
        const nuevoCosto = parseFloat(i.costo_unitario) || 0

        const { rows } = await client.query(
          `UPDATE inventario SET costo_unitario=$1, actualizado_en=NOW()
           WHERE id=$2 AND tenant_id=$3 RETURNING *`,
          [nuevoCosto, i.id, req.tenantId]
        )
        if (rows.length) {
          resultados.push(rows[0])
          await registrarAuditoria(client, {
            tenantId: req.tenantId, entidadId: i.id, entidadNombre: anterior.nombre,
            valorAnterior: anterior.costo_unitario, valorNuevo: nuevoCosto,
            metodo: 'masivo_lista', ip: req.ip,
          })
        }
      }
      return resultados
    })
    res.json({ actualizados: actualizados.length, insumos: actualizados })
  } catch (e) { next(e) }
})

// PUT /api/inventario/masivo/porcentaje — ajuste porcentual masivo
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
        'SELECT id, nombre, costo_unitario FROM inventario WHERE tenant_id = $1 AND activo = true', [req.tenantId]
      )
      const resultados = []
      for (const ins of afectados) {
        const nuevoCosto = Math.round(ins.costo_unitario * factor * 1000000) / 1000000
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

// PUT /api/inventario/:id — editar insumo individual normalizado
router.put('/:id', requireRol('admin'), requireAdminPin, async (req, res, next) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(req.params.id)) {
    return res.status(400).json({ error: 'ID de insumo inválido' })
  }

  const { existencia, unidad, consumo_diario, punto_reposicion, costo_unitario, densidad_g_ml } = req.body

  try {
    const actualizado = await transaction(async (client) => {
      const { rows: anteriorRows } = await client.query(
        'SELECT * FROM inventario WHERE id=$1 AND tenant_id=$2',
        [req.params.id, req.tenantId]
      )
      if (!anteriorRows.length) return null
      const anterior = anteriorRows[0]

      // Normalizar datos entrantes con fallback al valor anterior si no se envía
      const norm = normalizarInsumo({
        nombre: anterior.nombre,
        existencia: existencia !== undefined ? existencia : anterior.existencia,
        unidad: unidad !== undefined ? unidad : anterior.unidad,
        consumo_diario: consumo_diario !== undefined ? consumo_diario : anterior.consumo_diario,
        punto_reposicion: punto_reposicion !== undefined ? punto_reposicion : anterior.punto_reposicion,
        costo_unitario: costo_unitario !== undefined ? costo_unitario : anterior.costo_unitario
      })

      const dGml = densidad_g_ml !== undefined ? (densidad_g_ml ? parseFloat(densidad_g_ml) : null) : anterior.densidad_g_ml

      const { rows } = await client.query(`
        UPDATE inventario 
        SET existencia=$1, unidad=$2, consumo_diario=$3, punto_reposicion=$4, costo_unitario=$5, densidad_g_ml=$6, actualizado_en=NOW()
        WHERE id=$7 AND tenant_id=$8 RETURNING *
      `, [norm.existencia, norm.unidad, norm.consumo_diario, norm.punto_reposicion, norm.costo_unitario, dGml, req.params.id, req.tenantId])

      if (rows.length && parseFloat(norm.costo_unitario) !== parseFloat(anterior.costo_unitario)) {
        await registrarAuditoria(client, {
          tenantId: req.tenantId, entidadId: req.params.id, entidadNombre: anterior.nombre,
          valorAnterior: anterior.costo_unitario, valorNuevo: norm.costo_unitario,
          metodo: 'individual', ip: req.ip,
        })
      }
      return rows[0] || null
    })

    if (!actualizado) return res.status(404).json({ error: 'Insumo no encontrado' })
    res.json(actualizado)
  } catch (e) { next(e) }
})

// DELETE /api/inventario/:id — baja lógica si está en uso en recetas, o física si no
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows: insumo } = await query('SELECT nombre FROM inventario WHERE id=$1 AND tenant_id=$2', [req.params.id, req.tenantId])
    if (!insumo.length) return res.status(404).json({ error: 'Insumo no encontrado' })

    const insumoNombre = insumo[0].nombre

    // Verificar si está referenciado en ingredientes de recetas
    const { rows: countRows } = await query(
      'SELECT COUNT(*) as count FROM ingredientes WHERE tenant_id = $1 AND lower(trim(nombre)) = lower(trim($2))',
      [req.tenantId, insumoNombre]
    )
    const enUso = parseInt(countRows[0].count) > 0

    if (enUso) {
      // Baja lógica
      await query('UPDATE inventario SET activo = false, actualizado_en=NOW() WHERE id=$1 AND tenant_id=$2', [req.params.id, req.tenantId])
      res.json({ ok: true, tipo: 'logica', mensaje: 'Insumo en uso, desactivado lógicamente.' })
    } else {
      // Eliminación física
      await query('DELETE FROM inventario WHERE id=$1 AND tenant_id=$2', [req.params.id, req.tenantId])
      res.json({ ok: true, tipo: 'fisica', mensaje: 'Insumo eliminado físicamente.' })
    }
  } catch (e) { next(e) }
})

export default router
