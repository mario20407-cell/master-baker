import { Router } from 'express'
import { query } from '../db/client.js'

const router = Router()

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
      ORDER BY nombre
    `)
    res.json(rows)
  } catch (e) { next(e) }
})

// POST /api/inventario
router.post('/', async (req, res, next) => {
  const { nombre, existencia, unidad, consumo_diario, punto_reposicion, costo_unitario } = req.body
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' })
  try {
    const { rows } = await query(`
      INSERT INTO inventario (nombre, existencia, unidad, consumo_diario, punto_reposicion, costo_unitario)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (nombre) DO UPDATE SET
        existencia=EXCLUDED.existencia, unidad=EXCLUDED.unidad,
        consumo_diario=EXCLUDED.consumo_diario, punto_reposicion=EXCLUDED.punto_reposicion,
        costo_unitario=EXCLUDED.costo_unitario, actualizado_en=NOW()
      RETURNING *
    `, [nombre, existencia || 0, unidad || 'kg',
        consumo_diario || 0, punto_reposicion || 0, costo_unitario || 0])
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

// PUT /api/inventario/:id
router.put('/:id', async (req, res, next) => {
  const { existencia, consumo_diario, punto_reposicion, costo_unitario } = req.body
  try {
    const { rows } = await query(`
      UPDATE inventario SET existencia=$1, consumo_diario=$2,
        punto_reposicion=$3, costo_unitario=$4, actualizado_en=NOW()
      WHERE id=$5 RETURNING *
    `, [existencia, consumo_diario, punto_reposicion, costo_unitario, req.params.id])
    res.json(rows[0])
  } catch (e) { next(e) }
})

// DELETE /api/inventario/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM inventario WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { next(e) }
})

export default router
