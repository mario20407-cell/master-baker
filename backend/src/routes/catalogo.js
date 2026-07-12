import { Router } from 'express'
import multer from 'multer'
import ExcelJS from 'exceljs'
import { parse as parseCsv } from 'csv-parse/sync'
import { query, transaction } from '../db/client.js'
import { requireAdminPin } from '../middleware/adminPinMiddleware.js'
import { requireAuth, requireRol } from '../middleware/authMiddleware.js'

const router = Router()
router.use(requireAuth)

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } })

const COLUMNAS_ESPERADAS = ['nombre', 'categoria', 'presentacion', 'precio']
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
// ── Parseo compartido de archivo de importación (preview y confirmar usan la misma función) ──
async function parsearArchivo(file) {
  const nombreArchivo = (file.originalname || '').toLowerCase()
  let filasRaw = []

  if (nombreArchivo.endsWith('.csv')) {
    const registros = parseCsv(file.buffer, { columns: true, skip_empty_lines: true, trim: true })
    filasRaw = registros.map(r => ({ nombre: r.nombre, categoria: r.categoria, presentacion: r.presentacion, precio: r.precio }))
    if (registros.length) {
      const columnas = Object.keys(registros[0]).map(c => c.trim().toLowerCase())
      validarEncabezados(columnas)
    } else {
      validarEncabezados([])
    }
  } else {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(file.buffer)
    const hoja = workbook.worksheets[0]
    if (!hoja) throw new Error('El archivo no tiene hojas con datos')

    const filaEncabezado = hoja.getRow(1)
    const columnas = []
    filaEncabezado.eachCell({ includeEmpty: false }, cell => {
      columnas.push(String(cell.value || '').trim().toLowerCase())
    })
    validarEncabezados(columnas)

    const idx = {}
    columnas.forEach((c, i) => { idx[c] = i + 1 })

    hoja.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      filasRaw.push({
        nombre: row.getCell(idx.nombre).value,
        categoria: row.getCell(idx.categoria).value,
        presentacion: row.getCell(idx.presentacion).value,
        precio: row.getCell(idx.precio).value,
      })
    })
  }

  return filasRaw
}

function validarEncabezados(columnas) {
  const faltantes = COLUMNAS_ESPERADAS.filter(c => !columnas.includes(c))
  if (faltantes.length) {
    const err = new Error(`El archivo no tiene las columnas esperadas: ${COLUMNAS_ESPERADAS.join(', ')}`)
    err.status = 400
    throw err
  }
}

// Valida y clasifica cada fila. `existentes` es un Map nombre_normalizado -> producto de la base.
function evaluarFilas(filasRaw, existentes) {
  const vistosEnArchivo = new Map() // nombre_normalizado -> número de fila donde apareció primero
  const filas = []

  filasRaw.forEach((f, i) => {
    const numFila = i + 2 // +2: fila 1 es encabezado, arrays 0-indexados
    const nombre = String(f.nombre ?? '').trim()
    const categoria = String(f.categoria ?? '').trim()
    const presentacion = String(f.presentacion ?? '').trim() || 'unidad'
    const precioNum = parseFloat(f.precio)

    if (!nombre) {
      filas.push({ fila: numFila, accion: 'error', motivo: 'El nombre no puede estar vacío' })
      return
    }
    if (!categoria) {
      filas.push({ fila: numFila, accion: 'error', motivo: 'La categoría no puede estar vacía' })
      return
    }
    if (isNaN(precioNum) || precioNum <= 0 || precioNum > 1000000) {
      filas.push({ fila: numFila, accion: 'error', motivo: 'Precio inválido (debe ser mayor a cero y menor a 1,000,000)' })
      return
    }

    const nombreNorm = nombre.toLowerCase()
    if (vistosEnArchivo.has(nombreNorm)) {
      filas.push({ fila: numFila, accion: 'error', motivo: `Nombre duplicado dentro del archivo (ya aparece en la fila ${vistosEnArchivo.get(nombreNorm)})` })
      return
    }
    vistosEnArchivo.set(nombreNorm, numFila)

    const datos = { nombre, categoria, presentacion, precio: precioNum }
    const existente = existentes.get(nombreNorm)
    if (existente) {
      filas.push({
        fila: numFila, accion: 'actualizar', datos,
        valorActual: { categoria: existente.categoria, presentacion: existente.presentacion, precio: parseFloat(existente.precio) },
      })
    } else {
      filas.push({ fila: numFila, accion: 'crear', datos })
    }
  })

  return filas
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
// IMPORTANTE: las rutas masivas y de importación van antes de /:id, si no
// Express toma "masivo" o "importar" como si fuera el parámetro :id.

// POST /api/catalogo — creación individual de producto
router.post('/', requireRol('admin'), requireAdminPin, async (req, res, next) => {
  const { nombre, categoria, precio, presentacion } = req.body

  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre no puede estar vacío' })
  if (!categoria || !categoria.trim()) return res.status(400).json({ error: 'La categoría no puede estar vacía' })
  const pr = parseFloat(precio)
  if (isNaN(pr) || pr <= 0 || pr > 1000000) {
    return res.status(400).json({ error: 'El precio debe ser un número válido, mayor a cero y menor a 1,000,000' })
  }

  try {
    const creado = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO productos (tenant_id, nombre, categoria, precio, presentacion, activo)
         VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
        [req.tenantId, nombre.trim(), categoria.trim(), pr, (presentacion || 'unidad').trim()]
      )
      const producto = rows[0]
      await registrarAuditoria(client, {
        tenantId: req.tenantId, tipo: 'producto', entidadId: producto.id,
        entidadNombre: producto.nombre, campo: 'creacion',
        valorNuevo: producto.precio, metodo: 'creacion', ip: req.ip,
      })
      return producto
    })
    res.status(201).json(creado)
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un producto con ese nombre' })
    }
    next(e)
  }
})

// DELETE /api/catalogo/:id — soft-delete (activo=false), no borra físicamente
router.delete('/:id', requireRol('admin'), requireAdminPin, async (req, res, next) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(req.params.id)) {
    return res.status(400).json({ error: 'ID de producto inválido' })
  }

  try {
    const eliminado = await transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE productos SET activo=false, actualizado_en=NOW()
         WHERE id=$1 AND tenant_id=$2 AND activo=true RETURNING *`,
        [req.params.id, req.tenantId]
      )
      if (!rows.length) return null
      const producto = rows[0]
      await registrarAuditoria(client, {
        tenantId: req.tenantId, tipo: 'producto', entidadId: producto.id,
        entidadNombre: producto.nombre, campo: 'eliminacion',
        valorAnterior: producto.precio, valorNuevo: producto.precio,
        metodo: 'eliminacion', ip: req.ip,
      })
      return producto
    })
    if (!eliminado) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json({ eliminado: true, producto: eliminado })
  } catch (e) { next(e) }
})

// GET /api/catalogo/importar/plantilla — descarga plantilla .xlsx con columnas esperadas
router.get('/importar/plantilla', async (req, res, next) => {
  try {
    const workbook = new ExcelJS.Workbook()
    const hoja = workbook.addWorksheet('Catálogo')
    hoja.addRow(COLUMNAS_ESPERADAS)
    hoja.addRow(['Pan francés', 'Panes', 'unidad', 5])

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_catalogo.xlsx"')
    await workbook.xlsx.write(res)
    res.end()
  } catch (e) { next(e) }
})

// POST /api/catalogo/importar/preview — parsea y valida, NO escribe en la base
router.post('/importar/preview', requireRol('admin'), upload.single('archivo'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Se requiere un archivo (.xlsx o .csv)' })

  try {
    const filasRaw = await parsearArchivo(req.file)
    const { rows: existentesRows } = await query(
      'SELECT nombre, categoria, presentacion, precio FROM productos WHERE tenant_id=$1 AND activo=true',
      [req.tenantId]
    )
    const existentes = new Map(existentesRows.map(p => [p.nombre.toLowerCase(), p]))

    const filas = evaluarFilas(filasRaw, existentes)
    const resumen = {
      crear: filas.filter(f => f.accion === 'crear').length,
      actualizar: filas.filter(f => f.accion === 'actualizar').length,
      error: filas.filter(f => f.accion === 'error').length,
    }
    res.json({ filas, resumen })
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message })
    next(e)
  }
})

// POST /api/catalogo/importar/confirmar — revalida contra el estado actual y escribe (upsert por nombre)
router.post('/importar/confirmar', requireRol('admin'), requireAdminPin, upload.single('archivo'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Se requiere un archivo (.xlsx o .csv)' })

  try {
    const filasRaw = await parsearArchivo(req.file)
    const { rows: existentesRows } = await query(
      'SELECT nombre, categoria, presentacion, precio FROM productos WHERE tenant_id=$1 AND activo=true',
      [req.tenantId]
    )
    const existentes = new Map(existentesRows.map(p => [p.nombre.toLowerCase(), p]))
    const filas = evaluarFilas(filasRaw, existentes)

    let creados = 0, actualizados = 0
    const errores = filas.filter(f => f.accion === 'error').map(f => ({ fila: f.fila, motivo: f.motivo }))

    await transaction(async (client) => {
      for (const f of filas) {
        if (f.accion === 'error') continue
        const { nombre, categoria, presentacion, precio } = f.datos

        const { rows } = await client.query(
          `INSERT INTO productos (tenant_id, nombre, categoria, precio, presentacion, activo)
           VALUES ($1, $2, $3, $4, $5, true)
           ON CONFLICT (tenant_id, nombre) DO UPDATE
             SET categoria=$3, precio=$4, presentacion=$5, activo=true, actualizado_en=NOW()
           RETURNING *`,
          [req.tenantId, nombre, categoria, precio, presentacion]
        )
        const producto = rows[0]

        if (f.accion === 'crear') creados++
        else actualizados++

        await registrarAuditoria(client, {
          tenantId: req.tenantId, tipo: 'producto', entidadId: producto.id,
          entidadNombre: producto.nombre, campo: 'importacion',
          valorAnterior: f.valorActual?.precio, valorNuevo: producto.precio,
          metodo: 'importacion', ip: req.ip,
        })
      }
    })

    res.json({ creados, actualizados, errores })
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message })
    next(e)
  }
})

// PUT /api/catalogo/masivo/lista — edición masiva: lista explícita de {id, precio}
router.put('/masivo/lista', requireRol('admin'), requireAdminPin, async (req, res, next) => {
  const { productos = [] } = req.body
  if (!productos.length) return res.status(400).json({ error: 'Se requiere al menos un producto' })

  for (const p of productos) {
    const pr = parseFloat(p.precio)
    if (isNaN(pr) || pr <= 0 || pr > 1000000) {
      return res.status(400).json({ error: 'Todos los productos deben tener un precio válido (mayor a cero y menor a 1,000,000)' })
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
    if (isNaN(pr) || pr <= 0 || pr > 1000000) {
      return res.status(400).json({ error: 'El precio debe ser un número válido, mayor a cero y menor a 1,000,000' })
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