import { Router } from 'express'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { query } from '../db/client.js'
import { requireAuth, requireRol } from '../middleware/authMiddleware.js'
import {
  calcularPasivoColaborador, obtenerColaboradoresConDatosLaborales, sincronizarCostoIndirectoMano,
  calcularPlanilla, generarPlanilla, obtenerHistorialPlanillas, obtenerPlanilla,
} from '../services/pasivosLaboralesService.js'

const FRECUENCIAS_VALIDAS = ['semanal', 'quincenal', 'mensual']
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

// El costo de mano de obra aplicado al costeo de recetas se calcula a
// partir de estos mismos datos (ver sincronizarCostoIndirectoMano). Si la
// sincronización falla, no debe tumbar la operación de nómina que sí se
// guardó correctamente — se registra el error y se sigue.
async function sincronizarSinRomper(tenantId) {
  try {
    await sincronizarCostoIndirectoMano(query, tenantId)
  } catch (e) {
    console.warn('[pasivosLaborales] No se pudo sincronizar costo_indirecto_mano:', e.message)
  }
}

const router = Router()

// Toda esta información es sensible (salarios) — solo administradores.
router.use(requireAuth, requireRol('admin'))

// GET /api/pasivos-laborales/perfil — Lista de colaboradores con su perfil
// laboral (tipo de pago, salario fijo, fecha de ingreso).
router.get('/perfil', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, nombre, email, rol, tipo_pago, salario_mensual, fecha_ingreso
       FROM usuarios
       WHERE tenant_id = $1 AND activo = true
       ORDER BY nombre`,
      [req.tenantId]
    )
    res.json(rows)
  } catch (e) { next(e) }
})

// PUT /api/pasivos-laborales/perfil/:usuarioId — Actualiza el perfil
// laboral de un colaborador (tipo de pago, salario, fecha de ingreso).
router.put('/perfil/:usuarioId', async (req, res, next) => {
  const { tipo_pago, salario_mensual, fecha_ingreso } = req.body
  if (tipo_pago && !['fijo', 'variable'].includes(tipo_pago)) {
    return res.status(400).json({ error: 'tipo_pago debe ser "fijo" o "variable"' })
  }
  try {
    const { rows } = await query(
      `UPDATE usuarios
       SET tipo_pago = COALESCE($1, tipo_pago),
           salario_mensual = $2,
           fecha_ingreso = $3
       WHERE id = $4 AND tenant_id = $5
       RETURNING id, nombre, tipo_pago, salario_mensual, fecha_ingreso`,
      [tipo_pago || null, salario_mensual ?? null, fecha_ingreso || null, req.params.usuarioId, req.tenantId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Colaborador no encontrado' })
    await sincronizarSinRomper(req.tenantId)
    res.json(rows[0])
  } catch (e) { next(e) }
})

// GET /api/pasivos-laborales/pagos-variables/:usuarioId — Historial de
// pagos mensuales reales para colaboradores con pago variable (destajo,
// ej. pago por quintal producido). Devuelve los últimos 12 meses.
router.get('/pagos-variables/:usuarioId', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT mes, monto FROM pagos_variables
       WHERE usuario_id = $1 AND tenant_id = $2
       ORDER BY mes DESC LIMIT 12`,
      [req.params.usuarioId, req.tenantId]
    )
    res.json(rows)
  } catch (e) { next(e) }
})

// POST /api/pasivos-laborales/pagos-variables/:usuarioId — Registra o
// actualiza (upsert) el pago real de un mes específico. body: { mes:
// 'YYYY-MM-01' o 'YYYY-MM', monto: number }
router.post('/pagos-variables/:usuarioId', async (req, res, next) => {
  const { mes, monto } = req.body
  if (!mes || monto === undefined || monto === null) {
    return res.status(400).json({ error: 'mes y monto son requeridos' })
  }
  if (Number(monto) < 0) {
    return res.status(400).json({ error: 'El monto no puede ser negativo' })
  }
  try {
    const mesNormalizado = `${String(mes).slice(0, 7)}-01` // normaliza a primer día del mes
    const { rows } = await query(
      `INSERT INTO pagos_variables (tenant_id, usuario_id, mes, monto)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario_id, mes)
       DO UPDATE SET monto = EXCLUDED.monto
       RETURNING mes, monto`,
      [req.tenantId, req.params.usuarioId, mesNormalizado, monto]
    )
    await sincronizarSinRomper(req.tenantId)
    res.json(rows[0])
  } catch (e) { next(e) }
})

// GET /api/pasivos-laborales/dossier — Cálculo consolidado del pasivo
// laboral de todo el negocio: por colaborador y totales agregados.
router.get('/dossier', async (req, res, next) => {
  try {
    // 2 queries en total sin importar cuántos colaboradores haya (antes:
    // 1 query de pagos_variables por cada colaborador de pago variable,
    // dentro del loop — ver pasivosLaboralesService.js).
    const { colaboradores, empresaGrande } = await obtenerColaboradoresConDatosLaborales(query, req.tenantId)

    const detalle = []
    for (const colaborador of colaboradores) {
      const resultado = calcularPasivoColaborador(colaborador, colaborador.pagosVariables, empresaGrande)
      if (resultado) detalle.push(resultado)
    }

    const totales = detalle.reduce((acc, c) => ({
      aguinaldo: acc.aguinaldo + c.aguinaldo.monto,
      vacaciones: acc.vacaciones + c.vacaciones.monto,
      indemnizacionPotencial: acc.indemnizacionPotencial + c.indemnizacionPotencial.monto,
      inssPatronalMensual: acc.inssPatronalMensual + c.inssPatronalMensual.total,
      pasivoAcumulado: acc.pasivoAcumulado + c.pasivoAcumulado,
    }), { aguinaldo: 0, vacaciones: 0, indemnizacionPotencial: 0, inssPatronalMensual: 0, pasivoAcumulado: 0 })

    res.json({
      colaboradoresConDatos: detalle.length,
      colaboradoresTotal: colaboradores.length,
      empresaGrande,
      totales,
      detalle,
    })
  } catch (e) { next(e) }
})

// GET /api/pasivos-laborales/planilla/vista-previa?frecuencia=semanal&periodo_inicio=2026-07-27
// Calcula la planilla de un período SIN guardarla — para que el usuario
// revise los montos antes de generarla en firme.
router.get('/planilla/vista-previa', async (req, res, next) => {
  const { frecuencia, periodo_inicio } = req.query
  if (!FRECUENCIAS_VALIDAS.includes(frecuencia)) {
    return res.status(400).json({ error: 'frecuencia debe ser semanal, quincenal o mensual' })
  }
  if (!FECHA_RE.test(periodo_inicio || '')) {
    return res.status(400).json({ error: 'periodo_inicio debe tener formato YYYY-MM-DD' })
  }
  try {
    const resultado = await calcularPlanilla(query, req.tenantId, frecuencia, periodo_inicio)
    res.json(resultado)
  } catch (e) { next(e) }
})

// POST /api/pasivos-laborales/planilla/generar — Calcula y guarda la
// planilla de un período. Si ya existía una para ese periodo_inicio, la
// recalcula y reemplaza (útil si un salario cambió después).
// body: { frecuencia: 'semanal'|'quincenal'|'mensual', periodo_inicio: 'YYYY-MM-DD' }
router.post('/planilla/generar', async (req, res, next) => {
  const { frecuencia, periodo_inicio } = req.body
  if (!FRECUENCIAS_VALIDAS.includes(frecuencia)) {
    return res.status(400).json({ error: 'frecuencia debe ser semanal, quincenal o mensual' })
  }
  if (!FECHA_RE.test(periodo_inicio || '')) {
    return res.status(400).json({ error: 'periodo_inicio debe tener formato YYYY-MM-DD' })
  }
  try {
    const resultado = await generarPlanilla(query, req.tenantId, frecuencia, periodo_inicio, req.usuarioId || null)
    res.json(resultado)
  } catch (e) { next(e) }
})

// GET /api/pasivos-laborales/planilla/historial — Últimas planillas
// generadas (resumen, sin el detalle por colaborador).
router.get('/planilla/historial', async (req, res, next) => {
  try {
    const rows = await obtenerHistorialPlanillas(query, req.tenantId)
    res.json(rows)
  } catch (e) { next(e) }
})

// GET /api/pasivos-laborales/planilla/:id — Detalle completo de una
// planilla ya generada (para verla o exportarla).
router.get('/planilla/:id', async (req, res, next) => {
  try {
    const planilla = await obtenerPlanilla(query, req.tenantId, req.params.id)
    if (!planilla) return res.status(404).json({ error: 'Planilla no encontrada' })
    res.json(planilla)
  } catch (e) { next(e) }
})

// GET /api/pasivos-laborales/planilla/:id/exportar?formato=excel|pdf
router.get('/planilla/:id/exportar', async (req, res, next) => {
  const formato = String(req.query.formato || 'excel').toLowerCase()
  if (!['excel', 'pdf'].includes(formato)) {
    return res.status(400).json({ error: 'formato debe ser excel o pdf' })
  }
  try {
    const planilla = await obtenerPlanilla(query, req.tenantId, req.params.id)
    if (!planilla) return res.status(404).json({ error: 'Planilla no encontrada' })

    // Los NUMERIC de Postgres vienen como string vía node-pg — se
    // convierten acá una sola vez para que ambos exports (excel/pdf)
    // trabajen con números reales, no texto.
    const detalle = planilla.detalle.map(d => ({
      ...d,
      salario_bruto: Number(d.salario_bruto),
      inss_laboral: Number(d.inss_laboral),
      neto_a_pagar: Number(d.neto_a_pagar),
      inss_patronal: Number(d.inss_patronal),
      inatec: Number(d.inatec),
    }))
    const totales = {
      bruto: Number(planilla.total_bruto),
      inssLaboral: Number(planilla.total_inss_laboral),
      neto: Number(planilla.total_neto),
      inssPatronal: Number(planilla.total_inss_patronal),
      inatec: Number(planilla.total_inatec),
    }
    const nombreArchivo = `planilla_${planilla.periodo_inicio}_${planilla.frecuencia}`

    if (formato === 'excel') {
      const workbook = new ExcelJS.Workbook()
      const hoja = workbook.addWorksheet('Planilla')
      hoja.columns = [
        { header: 'Colaborador', key: 'nombre', width: 28 },
        { header: 'Tipo de pago', key: 'tipo_pago', width: 14 },
        { header: 'Salario bruto', key: 'salario_bruto', width: 16 },
        { header: 'INSS laboral (7%)', key: 'inss_laboral', width: 18 },
        { header: 'Neto a pagar', key: 'neto_a_pagar', width: 16 },
        { header: 'INSS patronal', key: 'inss_patronal', width: 16 },
        { header: 'INATEC (2%)', key: 'inatec', width: 14 },
      ]
      hoja.getRow(1).font = { bold: true }
      detalle.forEach(d => hoja.addRow(d))
      const filaTotal = hoja.addRow({
        nombre: 'TOTAL', tipo_pago: '',
        salario_bruto: totales.bruto, inss_laboral: totales.inssLaboral,
        neto_a_pagar: totales.neto, inss_patronal: totales.inssPatronal, inatec: totales.inatec,
      })
      filaTotal.font = { bold: true }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.xlsx"`)
      await workbook.xlsx.write(res)
      return res.end()
    }

    // PDF
    const fmt = n => 'C$' + (Number(n) || 0).toFixed(2)
    const cols = [
      { label: 'Colaborador', key: 'nombre', w: 170 },
      { label: 'Tipo', key: 'tipo_pago', w: 70 },
      { label: 'Bruto', key: 'salario_bruto', w: 80 },
      { label: 'INSS lab.', key: 'inss_laboral', w: 80 },
      { label: 'Neto', key: 'neto_a_pagar', w: 80 },
      { label: 'INSS patr.', key: 'inss_patronal', w: 80 },
      { label: 'INATEC', key: 'inatec', w: 70 },
    ]

    const doc = new PDFDocument({ margin: 40, size: 'letter', layout: 'landscape' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.pdf"`)
    doc.pipe(res)

    doc.fontSize(16).text('Master Baker — Planilla')
    doc.fontSize(10).fillColor('#666')
      .text(`Período: ${planilla.periodo_inicio} a ${planilla.periodo_fin}  ·  Frecuencia: ${planilla.frecuencia}`)
    doc.moveDown(1)

    const left = doc.page.margins.left
    let y = doc.y
    doc.fontSize(9).fillColor('#000').font('Helvetica-Bold')
    let x = left
    cols.forEach(c => { doc.text(c.label, x, y, { width: c.w }); x += c.w })
    y += 16
    doc.moveTo(left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke()
    y += 6
    doc.font('Helvetica')

    for (const d of detalle) {
      x = left
      cols.forEach(c => {
        const val = c.key === 'nombre' || c.key === 'tipo_pago' ? String(d[c.key]) : fmt(d[c.key])
        doc.text(val, x, y, { width: c.w })
        x += c.w
      })
      y += 16
      if (y > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage()
        y = doc.page.margins.top
      }
    }

    y += 6
    doc.moveTo(left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke()
    y += 8
    x = left
    doc.font('Helvetica-Bold')
    const filaTotales = [
      { key: 'nombre', val: 'TOTAL' }, { key: 'tipo_pago', val: '' },
      { key: 'salario_bruto', val: fmt(totales.bruto) }, { key: 'inss_laboral', val: fmt(totales.inssLaboral) },
      { key: 'neto_a_pagar', val: fmt(totales.neto) }, { key: 'inss_patronal', val: fmt(totales.inssPatronal) },
      { key: 'inatec', val: fmt(totales.inatec) },
    ]
    filaTotales.forEach((f, i) => { doc.text(f.val, x, y, { width: cols[i].w }); x += cols[i].w })

    doc.end()
  } catch (e) { next(e) }
})

export default router
