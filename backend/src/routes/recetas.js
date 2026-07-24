import { Router } from 'express'
import { query, transaction } from '../db/client.js'
import { requireAuth, requireRol } from '../middleware/authMiddleware.js'
import { registrarActividad } from '../services/bitacoraService.js'
import {
  calcularBaseSalarial,
  calcularInssPatronalMensual,
  calcularAguinaldoAcumulado,
  calcularVacacionesAcumuladas,
  mesesEntre,
} from '../services/pasivosLaboralesService.js'

const router = Router()

router.use(requireAuth)

// GET /api/recetas/configuracion-costeo/settings
router.get('/configuracion-costeo/settings', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM configuracion_costeo WHERE tenant_id = $1', [req.tenantId])
    if (!rows.length) {
      const { rows: [created] } = await query(
        'INSERT INTO configuracion_costeo (tenant_id) VALUES ($1) RETURNING *',
        [req.tenantId]
      )
      return res.json(created)
    }
    res.json(rows[0])
  } catch (e) { next(e) }
})

// PUT /api/recetas/configuracion-costeo/settings
router.put('/configuracion-costeo/settings', async (req, res, next) => {
  const { costo_indirecto_gas, costo_indirecto_luz, costo_indirecto_mano, margen_objetivo } = req.body
  try {
    const { rows } = await query(`
      INSERT INTO configuracion_costeo (tenant_id, costo_indirecto_gas, costo_indirecto_luz, costo_indirecto_mano, margen_objetivo, actualizado_en)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (tenant_id) DO UPDATE SET
        costo_indirecto_gas = EXCLUDED.costo_indirecto_gas,
        costo_indirecto_luz = EXCLUDED.costo_indirecto_luz,
        costo_indirecto_mano = EXCLUDED.costo_indirecto_mano,
        margen_objetivo = EXCLUDED.margen_objetivo,
        actualizado_en = NOW()
      RETURNING *
    `, [
      req.tenantId,
      parseFloat(costo_indirecto_gas) || 0,
      parseFloat(costo_indirecto_luz) || 0,
      parseFloat(costo_indirecto_mano) || 0,
      parseFloat(margen_objetivo) || 0
    ])
    res.json(rows[0])
  } catch (e) { next(e) }
})

// GET /api/recetas/configuracion-costeo/sugerencia-mano-obra
router.get('/configuracion-costeo/sugerencia-mano-obra', requireRol('admin'), async (req, res, next) => {
  try {
    // 1. Obtener la producción mensual de config_fiscal
    const { rows: fiscalRows } = await query(
      'SELECT produccion_mensual, configurado FROM config_fiscal WHERE tenant_id = $1',
      [req.tenantId]
    )
    // produccion_mensual tiene default 1 en la tabla — sin este chequeo de
    // "configurado", un tenant que nunca terminó de configurar la sección
    // fiscal igual pasaría la validación y el costo laboral total se
    // dividiría entre 1 pieza, dando una sugerencia disparatada.
    if (!fiscalRows.length || !fiscalRows[0].configurado) {
      return res.json({ sugerido: null, motivo: 'fiscal_no_configurado' })
    }
    if (!fiscalRows[0].produccion_mensual || parseInt(fiscalRows[0].produccion_mensual) <= 0) {
      return res.json({ sugerido: null, motivo: 'sin_produccion_mensual' })
    }
    const produccion_mensual = parseInt(fiscalRows[0].produccion_mensual)

    // 2. Obtener colaboradores activos
    const { rows: colaboradores } = await query(
      'SELECT id, tipo_pago, salario_mensual, fecha_ingreso FROM usuarios WHERE tenant_id = $1 AND activo = true',
      [req.tenantId]
    )

    // Filtrar colaboradores con pago configurado (fijo con salario_mensual > 0 o variable)
    const colaboradoresValidos = colaboradores.filter(c =>
      c.tipo_pago === 'fijo' || c.tipo_pago === 'variable'
    )

    if (colaboradoresValidos.length === 0) {
      return res.json({ sugerido: null, motivo: 'sin_datos_nomina' })
    }

    const { rows: totalActivos } = await query(
      'SELECT count(*) FROM usuarios WHERE tenant_id = $1 AND activo = true',
      [req.tenantId]
    )
    const empresaGrande = parseInt(totalActivos[0].count, 10) >= 50

    const hoy = new Date()
    let sumaCostoLaboralTotal = 0
    let colaboradoresConSueldo = 0

    for (const c of colaboradoresValidos) {
      let pagosVariables = []
      if (c.tipo_pago === 'variable') {
        const { rows: pagos } = await query(
          `SELECT mes, monto FROM pagos_variables
           WHERE usuario_id = $1 AND tenant_id = $2
           ORDER BY mes DESC LIMIT 6`,
          [c.id, req.tenantId]
        )
        pagosVariables = pagos
      }

      const base = calcularBaseSalarial(c, pagosVariables)
      if (base.sinDatos) continue

      const inss = calcularInssPatronalMensual(base.inssPatronal, empresaGrande)
      let costoLaboralMensual = base.inssPatronal + inss.total

      if (c.fecha_ingreso) {
        const mesesAntiguedad = mesesEntre(c.fecha_ingreso, hoy)
        if (mesesAntiguedad > 0) {
          const aguinaldo = calcularAguinaldoAcumulado(base.aguinaldo, c.fecha_ingreso, hoy)
          const vacaciones = calcularVacacionesAcumuladas(base.vacaciones, c.fecha_ingreso, hoy)
          if (aguinaldo.meses > 0) costoLaboralMensual += aguinaldo.monto / aguinaldo.meses
          costoLaboralMensual += vacaciones.monto / mesesAntiguedad
        }
      }

      sumaCostoLaboralTotal += costoLaboralMensual
      colaboradoresConSueldo++
    }

    if (colaboradoresConSueldo === 0) {
      return res.json({ sugerido: null, motivo: 'sin_datos_nomina' })
    }

    const sugerido = Math.round((sumaCostoLaboralTotal / produccion_mensual) * 100) / 100
    res.json({ sugerido })
  } catch (e) { next(e) }
})

// GET /api/recetas — todas las recetas del tenant, con ingredientes
router.get('/', async (req, res, next) => {
  try {
    const { rows: recetas } = await query(`
      SELECT r.*,
        json_agg(
          json_build_object(
            'id', i.id, 'nombre', i.nombre, 'cantidad', i.cantidad,
            'unidad', i.unidad, 'precio', i.precio, 'tipo', i.tipo,
            'unidad_inventario', inv.unidad, 'precio_inventario', inv.costo_unitario,
            'subreceta_nombre', i.subreceta_nombre,
            'costo_cero_intencional', i.costo_cero_intencional
          ) ORDER BY i.orden
        ) FILTER (WHERE i.id IS NOT NULL) AS ingredientes,
        p.precio AS pventa, p.presentacion, p.categoria
      FROM recetas r
      LEFT JOIN ingredientes i ON i.receta_id = r.id
      LEFT JOIN productos p ON p.nombre = r.producto AND p.tenant_id = r.tenant_id
      LEFT JOIN inventario inv ON inv.nombre = i.nombre AND inv.tenant_id = r.tenant_id
      WHERE r.tenant_id = $1
      GROUP BY r.id, p.precio, p.presentacion, p.categoria
      ORDER BY r.producto
    `, [req.tenantId])
    res.json(recetas.map(r => ({ ...r, ingredientes: r.ingredientes || [] })))
  } catch (e) { next(e) }
})

// GET /api/recetas/:producto
router.get('/:producto', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT r.*,
        json_agg(json_build_object(
          'id', i.id, 'nombre', i.nombre, 'cantidad', i.cantidad,
          'unidad', i.unidad, 'precio', i.precio, 'tipo', i.tipo,
          'costo_cero_intencional', i.costo_cero_intencional
        ) ORDER BY i.orden) FILTER (WHERE i.id IS NOT NULL) AS ingredientes,
        p.precio AS pventa, p.presentacion, p.categoria
      FROM recetas r
      LEFT JOIN ingredientes i ON i.receta_id = r.id
      LEFT JOIN productos p ON p.nombre = r.producto AND p.tenant_id = r.tenant_id
      LEFT JOIN inventario inv ON inv.nombre = i.nombre AND inv.tenant_id = r.tenant_id
      WHERE r.producto = $1 AND r.tenant_id = $2
      GROUP BY r.id, p.precio, p.presentacion, p.categoria
    `, [decodeURIComponent(req.params.producto), req.tenantId])

    if (!rows.length) return res.status(404).json({ error: 'Receta no encontrada' })
    res.json({ ...rows[0], ingredientes: rows[0].ingredientes || [] })
  } catch (e) { next(e) }
})

// POST /api/recetas — crear o actualizar receta completa con snapshot
router.post('/', async (req, res, next) => {
  const { 
    producto, piezas, peso_por_pieza, merma_pct, notas, ingredientes = [],
    costo_directo, costo_indirecto, margen_aplicado, precio_sugerido
  } = req.body
  const tenantId = req.tenantId
  if (!producto || !piezas) return res.status(400).json({ error: 'producto y piezas son requeridos' })

  // Validar costos cero intencionales
  for (const ing of ingredientes) {
    const pr = parseFloat(ing.precio) || 0
    if (pr === 0 && !ing.costo_cero_intencional) {
      return res.status(422).json({ 
        error: `El ingrediente "${ing.nombre}" tiene un costo de C$ 0.00. Si esto es correcto, marca la casilla "Costo cero intencional" para este ingrediente.` 
      })
    }
  }

  let esNueva = true
  try {
    const receta = await transaction(async (client) => {
      const { rows: checkReceta } = await client.query('SELECT id FROM recetas WHERE tenant_id = $1 AND producto = $2', [tenantId, producto])
      esNueva = checkReceta.length === 0

      // Upsert receta con columnas de snapshot
      const { rows: [r] } = await client.query(`
        INSERT INTO recetas (tenant_id, producto, piezas, peso_por_pieza, merma_pct, notas, costo_directo, costo_indirecto, margen_aplicado, precio_sugerido)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (tenant_id, producto) DO UPDATE SET
          piezas = EXCLUDED.piezas,
          peso_por_pieza = EXCLUDED.peso_por_pieza,
          merma_pct = EXCLUDED.merma_pct,
          notas = EXCLUDED.notas,
          costo_directo = EXCLUDED.costo_directo,
          costo_indirecto = EXCLUDED.costo_indirecto,
          margen_aplicado = EXCLUDED.margen_aplicado,
          precio_sugerido = EXCLUDED.precio_sugerido,
          actualizado_en = NOW()
        RETURNING *
      `, [
        tenantId, producto, piezas, peso_por_pieza || 0, merma_pct || 0, notas || '',
        costo_directo || 0, costo_indirecto || 0, margen_aplicado || 0, precio_sugerido || 0
      ])

      await client.query('DELETE FROM ingredientes WHERE receta_id = $1', [r.id])
      if (ingredientes.length) {
        // 8 columnas por fila ahora: tenant_id + receta_id + 6 campos del ingrediente
        const vals = ingredientes.map((_, idx) => `($${idx * 8 + 1}, $${idx * 8 + 2}, $${idx * 8 + 3}, $${idx * 8 + 4}, $${idx * 8 + 5}, $${idx * 8 + 6}, $${idx * 8 + 7}, $${idx * 8 + 8})`)
        const params = ingredientes.flatMap(ing => [
          tenantId, r.id, ing.nombre, parseFloat(ing.cantidad) || 0, 
          ing.unidad || 'g', parseFloat(ing.precio) || 0, ing.tipo || 'directo', 
          !!ing.costo_cero_intencional
        ])
        await client.query(`
          INSERT INTO ingredientes (tenant_id, receta_id, nombre, cantidad, unidad, precio, tipo, costo_cero_intencional) 
          VALUES ${vals}
        `, params)
      }
      return r
    })

    const { rows } = await query(`
      SELECT r.*, json_agg(json_build_object(
        'nombre', i.nombre, 'cantidad', i.cantidad, 'unidad', i.unidad, 'precio', i.precio, 'tipo', i.tipo, 'costo_cero_intencional', i.costo_cero_intencional
      )) FILTER (WHERE i.id IS NOT NULL) AS ingredientes,
      p.precio AS pventa, p.presentacion, p.categoria
      FROM recetas r
      LEFT JOIN ingredientes i ON i.receta_id = r.id
      LEFT JOIN productos p ON p.nombre = r.producto AND p.tenant_id = r.tenant_id
      LEFT JOIN inventario inv ON inv.nombre = i.nombre AND inv.tenant_id = r.tenant_id
      WHERE r.id = $1 GROUP BY r.id, p.precio, p.presentacion, p.categoria
    `, [receta.id])

    await registrarActividad(req, {
      modulo: 'recetas',
      accion: esNueva ? 'CREAR_RECETA' : 'MODIFICAR_RECETA',
      descripcion: `${esNueva ? 'Receta creada' : 'Receta modificada'} para el producto "${producto}" (${piezas} piezas, ${ingredientes.length} ingredientes)`,
      detalles: { producto, piezas, ingredientes_count: ingredientes.length }
    })

    res.status(201).json({ ...rows[0], ingredientes: rows[0].ingredientes || [] })
  } catch (e) { next(e) }
})

// PUT /api/recetas/:id — actualizar receta completa con snapshot
router.put('/:id', async (req, res, next) => {
  const { 
    piezas, peso_por_pieza, merma_pct, notas, ingredientes = [],
    costo_directo, costo_indirecto, margen_aplicado, precio_sugerido
  } = req.body
  const tenantId = req.tenantId

  // Validar costos cero intencionales
  for (const ing of ingredientes) {
    const pr = parseFloat(ing.precio) || 0
    if (pr === 0 && !ing.costo_cero_intencional) {
      return res.status(422).json({ 
        error: `El ingrediente "${ing.nombre}" tiene un costo de C$ 0.00. Si esto es correcto, marca la casilla "Costo cero intencional" para este ingrediente.` 
      })
    }
  }

  try {
    const actualizada = await transaction(async (client) => {
      const { rows: checkReceta } = await client.query('SELECT producto FROM recetas WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId])
      if (!checkReceta.length) return false
      const prodName = checkReceta[0].producto

      const { rowCount } = await client.query(`
        UPDATE recetas 
        SET piezas=$1, peso_por_pieza=$2, merma_pct=$3, notas=$4,
            costo_directo=$5, costo_indirecto=$6, margen_aplicado=$7, precio_sugerido=$8,
            actualizado_en=NOW()
        WHERE id=$9 AND tenant_id=$10
      `, [
        piezas, peso_por_pieza || 0, merma_pct || 0, notas || '',
        costo_directo || 0, costo_indirecto || 0, margen_aplicado || 0, precio_sugerido || 0,
        req.params.id, tenantId
      ])

      if (!rowCount) return false

      await client.query('DELETE FROM ingredientes WHERE receta_id=$1', [req.params.id])
      if (ingredientes.length) {
        const vals = ingredientes.map((_, i) => `($${i*8+1},$${i*8+2},$${i*8+3},$${i*8+4},$${i*8+5},$${i*8+6},$${i*8+7},$${i*8+8})`)
        await client.query(
          `INSERT INTO ingredientes (tenant_id,receta_id,nombre,cantidad,unidad,precio,tipo,costo_cero_intencional) VALUES ${vals}`,
          ingredientes.flatMap(i => [
            tenantId, req.params.id, i.nombre, parseFloat(i.cantidad)||0, i.unidad||'g', 
            parseFloat(i.precio)||0, i.tipo||'directo', !!i.costo_cero_intencional
          ])
        )
      }

      await registrarActividad(req, {
        modulo: 'recetas',
        accion: 'MODIFICAR_RECETA',
        descripcion: `Receta modificada para el producto "${prodName}" (${piezas} piezas, ${ingredientes.length} ingredientes)`,
        detalles: { receta_id: req.params.id, producto: prodName, piezas, ingredientes_count: ingredientes.length }
      })

      return true
    })

    if (!actualizada) return res.status(404).json({ error: 'Receta no encontrada' })
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// DELETE /api/recetas/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows: checkReceta } = await query('SELECT producto FROM recetas WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId])
    if (!checkReceta.length) return res.status(404).json({ error: 'Receta no encontrada' })
    const prodName = checkReceta[0].producto

    const { rowCount } = await query('DELETE FROM recetas WHERE id=$1 AND tenant_id=$2', [req.params.id, req.tenantId])
    if (!rowCount) return res.status(404).json({ error: 'Receta no encontrada' })

    await registrarActividad(req, {
      modulo: 'recetas',
      accion: 'ELIMINAR_RECETA',
      descripcion: `Receta eliminada para el producto "${prodName}"`,
      detalles: { receta_id: req.params.id, producto: prodName }
    })

    res.json({ ok: true })
  } catch (e) { next(e) }
})

// POST /api/recetas/import-csv — importar múltiples recetas desde CSV
router.post('/import-csv', async (req, res, next) => {
  const { filas = [] } = req.body
  const tenantId = req.tenantId
  if (!filas.length) return res.status(400).json({ error: 'Sin filas para importar' })

  try {
    const mapa = {}
    filas.forEach(f => {
      if (!f.Producto || !f.Ingrediente) return
      if (!mapa[f.Producto]) mapa[f.Producto] = []
      mapa[f.Producto].push({
        nombre: f.Ingrediente,
        cantidad: parseFloat(f.Cantidad) || 0,
        unidad: f.Unidad || 'g',
        precio: parseFloat(f.Precio_unitario_CS) || 0,
        tipo: f.Ingrediente.toLowerCase().includes('indirecto') ? 'indirecto' : 'directo',
        costo_cero_intencional: false
      })
    })

    let importadas = 0
    for (const [producto, ingredientes] of Object.entries(mapa)) {
      if (!ingredientes.some(i => i.cantidad > 0)) continue
      await transaction(async (client) => {
        const { rows: [r] } = await client.query(`
          INSERT INTO recetas (tenant_id, producto, piezas) VALUES ($1, $2, 100)
          ON CONFLICT (tenant_id, producto) DO UPDATE SET actualizado_en=NOW() RETURNING *
        `, [tenantId, producto])
        await client.query('DELETE FROM ingredientes WHERE receta_id=$1', [r.id])
        const vals = ingredientes.map((_, i) => `($${i*8+1},$${i*8+2},$${i*8+3},$${i*8+4},$${i*8+5},$${i*8+6},$${i*8+7},$${i*8+8})`)
        await client.query(
          `INSERT INTO ingredientes (tenant_id,receta_id,nombre,cantidad,unidad,precio,tipo,costo_cero_intencional) VALUES ${vals}`,
          ingredientes.flatMap(i => [
            tenantId, r.id, i.nombre, i.cantidad, i.unidad, i.precio, i.tipo, !!i.costo_cero_intencional
          ])
        )
      })
      importadas++
    }

    await registrarActividad(req, {
      modulo: 'recetas',
      accion: 'IMPORTAR_RECETAS_CSV',
      descripcion: `Importación masiva realizada desde archivo CSV (${importadas} recetas importadas de ${Object.keys(mapa).length} totales)`,
      detalles: { importadas, total: Object.keys(mapa).length }
    })

    res.json({ importadas, total: Object.keys(mapa).length })
  } catch (e) { next(e) }
})

export default router
