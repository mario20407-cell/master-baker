import { Router } from 'express'
import { query, transaction } from '../db/client.js'
import { checkInventarioInsumos } from '../services/alertas.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

router.use(requireAuth)

// GET /api/inventario
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

// POST /api/inventario
router.post('/', async (req, res, next) => {
  const { nombre, existencia, unidad, consumo_diario, punto_reposicion, costo_unitario } = req.body
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' })
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

// POST /api/inventario/importar — upsert masivo desde Excel
router.post('/importar', async (req, res, next) => {
  const { filas } = req.body
  if (!Array.isArray(filas)) return res.status(400).json({ error: 'filas debe ser un arreglo' })

  const errores = []
  let insertados = 0
  let actualizados = 0

  try {
    await transaction(async (client) => {
      for (let i = 0; i < filas.length; i++) {
        const fila = filas[i] || {}
        const nombre = (fila.nombre || '').toString().trim()
        const existencia = Number(fila.existencia)
        const costo_unitario = Number(fila.costo_unitario)

        if (!nombre) {
          errores.push({ fila: i + 1, motivo: 'nombre es requerido' })
          continue
        }
        if (!(existencia >= 0)) {
          errores.push({ fila: i + 1, motivo: 'existencia debe ser mayor o igual a 0' })
          continue
        }
        if (!(costo_unitario >= 0)) {
          errores.push({ fila: i + 1, motivo: 'costo unitario debe ser mayor o igual a 0' })
          continue
        }

        const { rows } = await client.query(`
          INSERT INTO inventario (tenant_id, nombre, existencia, unidad, punto_reposicion, costo_unitario)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (tenant_id, nombre) DO UPDATE SET
            existencia=EXCLUDED.existencia, unidad=EXCLUDED.unidad,
            punto_reposicion=EXCLUDED.punto_reposicion, costo_unitario=EXCLUDED.costo_unitario,
            actualizado_en=NOW()
          RETURNING (xmax = 0) AS inserted
        `, [req.tenantId, nombre, existencia, fila.unidad || 'kg',
            Number(fila.punto_reposicion) || 0, costo_unitario])

        if (rows[0].inserted) insertados++
        else actualizados++
      }
    })
    res.json({ insertados, actualizados, errores })
  } catch (e) { next(e) }
})

// PUT /api/inventario/:id
router.put('/:id', async (req, res, next) => {
  const { existencia, consumo_diario, punto_reposicion, costo_unitario } = req.body
  try {
    const { rows } = await query(`
      UPDATE inventario SET existencia=$1, consumo_diario=$2,
        punto_reposicion=$3, costo_unitario=$4, actualizado_en=NOW()
      WHERE id=$5 AND tenant_id=$6 RETURNING *
    `, [existencia, consumo_diario, punto_reposicion, costo_unitario, req.params.id, req.tenantId])
    if (!rows.length) return res.status(404).json({ error: 'Insumo no encontrado' })
    res.json(rows[0])
    checkInventarioInsumos(req.tenantId).catch(() => {})
  } catch (e) { next(e) }
})

// DELETE /api/inventario/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM inventario WHERE id=$1 AND tenant_id=$2', [req.params.id, req.tenantId])
    if (!rowCount) return res.status(404).json({ error: 'Insumo no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
})

export default router
