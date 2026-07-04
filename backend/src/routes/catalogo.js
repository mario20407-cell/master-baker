import { Router } from 'express'
import { query, transaction } from '../db/client.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

// GET /api/catalogo — solo productos del tenant activo
router.get('/', requireAuth, async (req, res, next) => {
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

// PUT /api/catalogo/:id — actualizar precio (solo si pertenece al tenant)
router.put('/:id', requireAuth, async (req, res, next) => {
  const { precio, presentacion } = req.body
  try {
    const { rows } = await query(
      `UPDATE productos SET precio=$1, presentacion=$2, actualizado_en=NOW()
       WHERE id=$3 AND tenant_id=$4 RETURNING *`,
      [precio, presentacion, req.params.id, req.tenantId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json(rows[0])
  } catch (e) { next(e) }
})

// POST /api/catalogo/importar — upsert masivo desde Excel
router.post('/importar', requireAuth, async (req, res, next) => {
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
        const precio = Number(fila.precio)

        if (!nombre) {
          errores.push({ fila: i + 1, motivo: 'nombre es requerido' })
          continue
        }
        if (!(precio > 0)) {
          errores.push({ fila: i + 1, motivo: 'precio debe ser mayor a 0' })
          continue
        }

        const { rows } = await client.query(`
          INSERT INTO productos (tenant_id, nombre, precio, categoria, presentacion)
          VALUES ($1,$2,$3,$4,$5)
          ON CONFLICT (tenant_id, nombre) DO UPDATE SET
            precio=EXCLUDED.precio, categoria=EXCLUDED.categoria,
            presentacion=EXCLUDED.presentacion, actualizado_en=NOW()
          RETURNING (xmax = 0) AS inserted
        `, [req.tenantId, nombre, precio, fila.categoria || null, fila.presentacion || 'unidad'])

        if (rows[0].inserted) insertados++
        else actualizados++
      }
    })
    res.json({ insertados, actualizados, errores })
  } catch (e) { next(e) }
})

export default router
