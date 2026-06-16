import { Router } from 'express'
import { query } from '../db/client.js'

const router = Router()

const csvHeaders = (res, filename) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.write('\uFEFF') // BOM para Excel
}

const escapeCsv = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

const toRow = (cols) => cols.map(escapeCsv).join(',') + '\n'

// GET /api/exportar/catalogo
router.get('/catalogo', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT p.nombre, p.precio, p.presentacion, p.categoria,
        CASE WHEN r.id IS NOT NULL THEN 'Sí' ELSE 'No' END AS tiene_receta
      FROM productos p
      LEFT JOIN recetas r ON r.producto = p.nombre
      WHERE p.activo = true ORDER BY p.categoria, p.nombre
    `)
    csvHeaders(res, 'catalogo_marquez.csv')
    res.write(toRow(['Nombre', 'Precio (C$)', 'Presentación', 'Categoría', 'Tiene receta']))
    rows.forEach(r => res.write(toRow([r.nombre, r.precio, r.presentacion, r.categoria, r.tiene_receta])))
    res.end()
  } catch (e) { next(e) }
})

// GET /api/exportar/recetas
router.get('/recetas', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT r.producto, r.piezas, r.peso_por_pieza, r.merma_pct,
        i.nombre AS ingrediente, i.cantidad, i.unidad, i.precio, i.tipo
      FROM recetas r
      JOIN ingredientes i ON i.receta_id = r.id
      ORDER BY r.producto, i.orden
    `)
    csvHeaders(res, 'recetas_marquez.csv')
    res.write(toRow(['Producto', 'Piezas base', 'Peso/pieza (g)', '% Merma',
      'Ingrediente', 'Cantidad', 'Unidad', 'Precio C$/u', 'Tipo']))
    rows.forEach(r => res.write(toRow([
      r.producto, r.piezas, r.peso_por_pieza, r.merma_pct,
      r.ingrediente, r.cantidad, r.unidad, r.precio, r.tipo
    ])))
    res.end()
  } catch (e) { next(e) }
})

// GET /api/exportar/costeos
router.get('/costeos', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT producto, piezas_obj, piezas_reales, costo_directo, costo_indirecto,
        costo_total, costo_unitario, precio_venta, margen_pct, utilidad_neta,
        CASE WHEN aprobado THEN 'Aprobado' ELSE 'Rechazado' END AS estado,
        TO_CHAR(creado_en, 'YYYY-MM-DD HH24:MI') AS fecha
      FROM costeos ORDER BY creado_en DESC LIMIT 500
    `)
    csvHeaders(res, 'costeos_marquez.csv')
    res.write(toRow(['Producto', 'Piezas obj.', 'Piezas reales', 'Costo directo',
      'Costo indirecto', 'Costo total', 'Costo unitario', 'Precio venta',
      'Margen %', 'Utilidad neta', 'Estado', 'Fecha']))
    rows.forEach(r => res.write(toRow([
      r.producto, r.piezas_obj, r.piezas_reales, r.costo_directo, r.costo_indirecto,
      r.costo_total, r.costo_unitario, r.precio_venta, r.margen_pct,
      r.utilidad_neta, r.estado, r.fecha
    ])))
    res.end()
  } catch (e) { next(e) }
})

// GET /api/exportar/inventario
router.get('/inventario', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT nombre, existencia, unidad, consumo_diario, punto_reposicion,
        costo_unitario,
        CASE WHEN consumo_diario > 0 THEN FLOOR(existencia/consumo_diario) ELSE NULL END AS dias_restantes,
        TO_CHAR(actualizado_en, 'YYYY-MM-DD') AS actualizado
      FROM inventario ORDER BY nombre
    `)
    csvHeaders(res, 'inventario_marquez.csv')
    res.write(toRow(['Insumo', 'Existencia', 'Unidad', 'Consumo diario',
      'Punto reposición', 'Costo unitario (C$)', 'Días restantes', 'Actualizado']))
    rows.forEach(r => res.write(toRow([
      r.nombre, r.existencia, r.unidad, r.consumo_diario,
      r.punto_reposicion, r.costo_unitario, r.dias_restantes ?? '—', r.actualizado
    ])))
    res.end()
  } catch (e) { next(e) }
})

// GET /api/exportar/compras
router.get('/compras', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT f.proveedor, TO_CHAR(f.fecha,'YYYY-MM-DD') AS fecha, f.total,
        fi.producto, fi.cantidad, fi.precio_actual, fi.precio_anterior,
        fi.variacion_pct,
        CASE WHEN fi.alerta THEN 'ALERTA' ELSE '' END AS alerta
      FROM facturas f
      JOIN factura_items fi ON fi.factura_id = f.id
      ORDER BY f.fecha DESC, f.creado_en DESC
    `)
    csvHeaders(res, 'compras_marquez.csv')
    res.write(toRow(['Proveedor', 'Fecha', 'Total factura (C$)', 'Producto',
      'Cantidad', 'Precio actual', 'Precio anterior', 'Variación %', 'Alerta']))
    rows.forEach(r => res.write(toRow([
      r.proveedor, r.fecha, r.total, r.producto,
      r.cantidad, r.precio_actual, r.precio_anterior, r.variacion_pct ?? '—', r.alerta
    ])))
    res.end()
  } catch (e) { next(e) }
})

// GET /api/exportar/reporte — reporte ejecutivo completo
router.get('/reporte', async (req, res, next) => {
  try {
    const [{ rows: resumen }] = await Promise.all([query(`
      SELECT
        (SELECT COUNT(*) FROM productos WHERE activo) AS total_productos,
        (SELECT COUNT(*) FROM recetas) AS total_recetas,
        (SELECT COUNT(*) FROM costeos) AS total_costeos,
        (SELECT COUNT(*) FROM costeos WHERE aprobado = false) AS costeos_rechazados,
        (SELECT ROUND(AVG(margen_pct),2) FROM costeos WHERE margen_pct IS NOT NULL) AS margen_promedio,
        (SELECT SUM(utilidad_neta) FROM costeos WHERE aprobado = true) AS utilidad_total,
        (SELECT COUNT(*) FROM inventario WHERE consumo_diario > 0 AND existencia/consumo_diario <= 3) AS insumos_criticos
    `)])

    const { rows: topCosteos } = await query(`
      SELECT producto, ROUND(AVG(margen_pct),2) AS margen_avg,
        ROUND(AVG(costo_unitario),4) AS cu_avg, COUNT(*) AS veces_costeado
      FROM costeos GROUP BY producto ORDER BY margen_avg DESC LIMIT 10
    `)

    csvHeaders(res, 'reporte_ejecutivo_marquez.csv')

    res.write('REPORTE EJECUTIVO — MARQUÉZ PANADERÍA & REPOSTERÍA\n')
    res.write(`Generado: ${new Date().toLocaleString('es-NI')}\n\n`)

    res.write('RESUMEN GENERAL\n')
    res.write(toRow(['Indicador', 'Valor']))
    const r = resumen[0]
    res.write(toRow(['Productos activos', r.total_productos]))
    res.write(toRow(['Recetas guardadas', r.total_recetas]))
    res.write(toRow(['Total costeos', r.total_costeos]))
    res.write(toRow(['Costeos rechazados (margen <60%)', r.costeos_rechazados]))
    res.write(toRow(['Margen promedio (%)', r.margen_promedio ?? '—']))
    res.write(toRow(['Utilidad neta acumulada (C$)', r.utilidad_total ?? 0]))
    res.write(toRow(['Insumos críticos (≤3 días)', r.insumos_criticos]))

    res.write('\nTOP 10 PRODUCTOS POR MARGEN\n')
    res.write(toRow(['Producto', 'Margen promedio %', 'Costo unitario C$', 'Veces costeado']))
    topCosteos.forEach(c => res.write(toRow([c.producto, c.margen_avg, c.cu_avg, c.veces_costeado])))

    res.end()
  } catch (e) { next(e) }
})

export default router
