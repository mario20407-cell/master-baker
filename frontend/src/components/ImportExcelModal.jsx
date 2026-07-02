import { useState } from 'react'
import { X, Upload, Download, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  parseCatalogoExcel, validarFilasCatalogo, generarPlantillaCatalogo,
  parseInventarioExcel, validarFilasInventario, generarPlantillaInventario,
} from '../lib/excelImport'
import { importCatalogo, importInventario } from '../lib/api'

const CONFIG = {
  catalogo: {
    titulo: 'Importar catálogo desde Excel',
    columnas: [
      { key: 'nombre', label: 'Nombre' },
      { key: 'precio', label: 'Precio' },
      { key: 'categoria', label: 'Categoría' },
      { key: 'presentacion', label: 'Presentación' },
    ],
    parse: parseCatalogoExcel,
    validar: validarFilasCatalogo,
    plantilla: generarPlantillaCatalogo,
    importar: importCatalogo,
  },
  inventario: {
    titulo: 'Importar inventario desde Excel',
    columnas: [
      { key: 'nombre', label: 'Nombre' },
      { key: 'existencia', label: 'Existencia' },
      { key: 'unidad', label: 'Unidad' },
      { key: 'costo_unitario', label: 'Costo Unitario' },
      { key: 'punto_reposicion', label: 'Punto de Reposición' },
    ],
    parse: parseInventarioExcel,
    validar: validarFilasInventario,
    plantilla: generarPlantillaInventario,
    importar: importInventario,
  },
}

export default function ImportExcelModal({ tipo, onClose, onImported }) {
  const cfg = CONFIG[tipo]
  const [filas, setFilas] = useState(null)
  const [cargando, setCargando] = useState(false)

  const handleArchivo = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parseadas = await cfg.parse(file)
      setFilas(cfg.validar(parseadas))
    } catch {
      toast.error('No se pudo leer el archivo. Verifica que sea un .xlsx válido.')
    }
  }

  const hayErrores = filas?.some(f => f.error)

  const handleConfirmar = async () => {
    setCargando(true)
    try {
      const { data } = await cfg.importar(filas)
      toast.success(`${data.insertados} insertados, ${data.actualizados} actualizados${data.errores.length ? `, ${data.errores.length} con error` : ''}`)
      onImported?.(data)
      onClose()
    } catch {
      toast.error('Error al importar el archivo')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2">
            <FileSpreadsheet size={16} /> {cfg.titulo}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          <button onClick={cfg.plantilla} className="btn-secondary text-xs py-1.5 flex items-center gap-2">
            <Download size={13} /> Descargar plantilla
          </button>

          <div className="form-group">
            <label className="form-label">Archivo .xlsx</label>
            <input type="file" accept=".xlsx,.xls" onChange={handleArchivo} />
          </div>

          {filas && (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    {cfg.columnas.map(c => <th key={c.key}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={i} className={f.error ? 'bg-red-50' : f.duplicado ? 'bg-yellow-50' : ''}>
                      {cfg.columnas.map(c => <td key={c.key}>{f[c.key]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filas.some(f => f.error) && (
                <div className="text-xs text-red-600 mt-2">
                  {filas.filter(f => f.error).map((f, i) => <div key={i}>{f.nombre || `Fila ${i + 1}`}: {f.error}</div>)}
                </div>
              )}
              {filas.some(f => f.duplicado && !f.error) && (
                <div className="text-xs text-yellow-700 mt-2">Filas en amarillo: nombre repetido en el archivo (se sobrescribirán entre sí).</div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-xs py-1.5">Cancelar</button>
          <button
            onClick={handleConfirmar}
            disabled={!filas || filas.length === 0 || hayErrores || cargando}
            className="btn-primary text-xs py-1.5 flex items-center gap-2 disabled:opacity-50">
            <Upload size={13} /> {cargando ? 'Importando...' : 'Confirmar importación'}
          </button>
        </div>
      </div>
    </div>
  )
}
