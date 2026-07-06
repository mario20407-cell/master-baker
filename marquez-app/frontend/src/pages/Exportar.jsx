import { useState } from 'react'
import { exportarReporte } from '../lib/api'
import { Download, FileText, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const EXPORTS = [
  { id: 'catalogo',   label: 'Catálogo de productos',        desc: '49 productos con precio, categoría y estado de receta', primary: true },
  { id: 'recetas',    label: 'Recetas completas',             desc: 'Todos los ingredientes con cantidades y precios' },
  { id: 'costeos',    label: 'Historial de costeos',          desc: 'Todos los costeos calculados con margen y utilidad' },
  { id: 'inventario', label: 'Inventario actual',             desc: 'Insumos con existencias, días restantes y alertas' },
  { id: 'compras',    label: 'Historial de compras',          desc: 'Facturas con variaciones de precio y alertas' },
  { id: 'reporte',    label: 'Reporte ejecutivo completo',    desc: 'Resumen financiero general + top 10 productos por margen', primary: true },
]

export default function Exportar() {
  const [descargando, setDescargando] = useState(null)
  const [descargados, setDescargados] = useState([])

  const descargar = async (tipo) => {
    setDescargando(tipo)
    try {
      const { data } = await exportarReporte(tipo)
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${tipo}_marquez.csv`
      a.click()
      URL.revokeObjectURL(url)
      setDescargados(prev => [...new Set([...prev, tipo])])
      toast.success(`${tipo}.csv descargado`)
    } catch (e) {
      toast.error('Error al descargar. Verifica que el backend esté activo.')
    } finally {
      setDescargando(null)
    }
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="alert-info">
        <FileText size={17} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium text-blue-800">Exportación CSV — compatible con Excel y Google Sheets</div>
          <div className="text-xs text-blue-700 mt-0.5">Todos los archivos incluyen BOM UTF-8 para caracteres en español.</div>
        </div>
      </div>

      {EXPORTS.map(exp => (
        <div key={exp.id} className={`card flex items-center justify-between gap-4 ${exp.primary ? 'border-brand-400/30' : ''}`}>
          <div>
            <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
              {exp.label}
              {exp.primary && <span className="badge-info text-[10px]">Recomendado</span>}
              {descargados.includes(exp.id) && <CheckCircle size={13} className="text-green-500" />}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{exp.desc}</div>
          </div>
          <button
            onClick={() => descargar(exp.id)}
            disabled={descargando === exp.id}
            className={`flex-shrink-0 flex items-center gap-2 ${exp.primary ? 'btn-primary' : 'btn-secondary'} disabled:opacity-50`}>
            <Download size={13} />
            {descargando === exp.id ? 'Descargando...' : 'CSV'}
          </button>
        </div>
      ))}
    </div>
  )
}
