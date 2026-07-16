import { Router } from 'express'
import { query } from '../db/client.js'
import { requireAuth, requireRol } from '../middleware/authMiddleware.js'
import { calcularPasivoColaborador } from '../services/pasivosLaboralesService.js'

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
    res.json(rows[0])
  } catch (e) { next(e) }
})

// GET /api/pasivos-laborales/dossier — Cálculo consolidado del pasivo
// laboral de todo el negocio: por colaborador y totales agregados.
router.get('/dossier', async (req, res, next) => {
  try {
    const { rows: colaboradores } = await query(
      `SELECT id, nombre, email, rol, tipo_pago, salario_mensual, fecha_ingreso
       FROM usuarios
       WHERE tenant_id = $1 AND activo = true
       ORDER BY nombre`,
      [req.tenantId]
    )

    const { rows: totalActivos } = await query(
      'SELECT count(*) FROM usuarios WHERE tenant_id = $1 AND activo = true',
      [req.tenantId]
    )
    const empresaGrande = parseInt(totalActivos[0].count, 10) >= 50

    const detalle = []
    for (const colaborador of colaboradores) {
      let pagosVariables = []
      if (colaborador.tipo_pago === 'variable') {
        const { rows } = await query(
          `SELECT mes, monto FROM pagos_variables
           WHERE usuario_id = $1 AND tenant_id = $2
           ORDER BY mes DESC LIMIT 6`,
          [colaborador.id, req.tenantId]
        )
        pagosVariables = rows
      }
      const resultado = calcularPasivoColaborador(colaborador, pagosVariables, empresaGrande)
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

export default router
