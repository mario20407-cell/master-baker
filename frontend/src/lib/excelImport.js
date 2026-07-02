import * as XLSX from 'xlsx'

function normalizarClave(header) {
  return header
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
}

function leerHoja(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' })
        const hoja = wb.Sheets[wb.SheetNames[0]]
        const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' })
        resolve(filas.map((fila) => {
          const normalizada = {}
          for (const key of Object.keys(fila)) normalizada[normalizarClave(key)] = fila[key]
          return normalizada
        }))
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsBinaryString(file)
  })
}

// ── Catálogo ─────────────────────────────────────────────────────────────────

export async function parseCatalogoExcel(file) {
  const filas = await leerHoja(file)
  return filas.map((f) => ({
    nombre: (f.nombre || '').toString().trim(),
    precio: Number(f.precio),
    categoria: (f.categoria || '').toString().trim(),
    presentacion: (f.presentacion || 'unidad').toString().trim(),
  }))
}

export function validarFilasCatalogo(filas) {
  const nombresVistos = new Map()
  filas.forEach((f) => nombresVistos.set(f.nombre.toLowerCase(), (nombresVistos.get(f.nombre.toLowerCase()) || 0) + 1))

  return filas.map((f) => {
    const problemas = []
    if (!f.nombre) problemas.push('nombre vacío')
    if (!(f.precio > 0)) problemas.push('precio debe ser mayor a 0')
    const duplicado = f.nombre && nombresVistos.get(f.nombre.toLowerCase()) > 1
    return {
      ...f,
      error: problemas.length > 0 ? problemas.join(', ') : null,
      duplicado,
    }
  })
}

export function generarPlantillaCatalogo() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet([
    { Nombre: 'Dona azucarada', Precio: 20, Categoría: 'Donas', Presentación: 'unidad' },
  ])
  XLSX.utils.book_append_sheet(wb, ws, 'Catalogo')
  XLSX.writeFile(wb, 'plantilla_catalogo.xlsx')
}

// ── Inventario ───────────────────────────────────────────────────────────────

export async function parseInventarioExcel(file) {
  const filas = await leerHoja(file)
  return filas.map((f) => ({
    nombre: (f.nombre || '').toString().trim(),
    existencia: Number(f.existencia),
    unidad: (f.unidad || 'kg').toString().trim(),
    costo_unitario: Number(f.costo_unitario),
    punto_reposicion: Number(f.punto_de_reposicion ?? f.punto_reposicion ?? 0),
  }))
}

export function validarFilasInventario(filas) {
  const nombresVistos = new Map()
  filas.forEach((f) => nombresVistos.set(f.nombre.toLowerCase(), (nombresVistos.get(f.nombre.toLowerCase()) || 0) + 1))

  return filas.map((f) => {
    const problemas = []
    if (!f.nombre) problemas.push('nombre vacío')
    if (!(f.existencia >= 0)) problemas.push('existencia inválida')
    if (!(f.costo_unitario >= 0)) problemas.push('costo unitario inválido')
    const duplicado = f.nombre && nombresVistos.get(f.nombre.toLowerCase()) > 1
    return {
      ...f,
      error: problemas.length > 0 ? problemas.join(', ') : null,
      duplicado,
    }
  })
}

export function generarPlantillaInventario() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet([
    { Nombre: 'Harina', Existencia: 50, Unidad: 'kg', 'Costo Unitario': 25, 'Punto de Reposición': 10 },
  ])
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
  XLSX.writeFile(wb, 'plantilla_inventario.xlsx')
}
