import { useState, useEffect } from 'react'
import { getInventario, saveInsumo, deleteInsumo, updateInsumo } from '../lib/api'
import { Package, Plus, Trash2, Edit2, AlertTriangle, FileSpreadsheet, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ImportExcelModal from '../components/ImportExcelModal'

export default function Inventario() {
  const [insumos, setInsumos] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', existencia: '', unidad: 'kg', consumo_diario: '', punto_reposicion: '', costo_unitario: '' })
  const [mostrarImport, setMostrarImport] = useState(false)

  const cargar = async () => {
    try {
      const { data } = await getInventario()
      setInsumos(data)
    } catch (e) {
      const local = localStorage.getItem('marquez_inventario')
      if (local) setInsumos(JSON.parse(local))
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const handleGuardar = async () => {
    if (!form.nombre || !form.existencia) { toast.error('Nombre y existencia son requeridos'); return }
    try {
      if (form.id) {
        await updateInsumo(form.id, {
          nombre: form.nombre,
          existencia: parseFloat(form.existencia),
          unidad: form.unidad,
          consumo_diario: parseFloat(form.consumo_diario) || 0,
          punto_reposicion: parseFloat(form.punto_reposicion) || 0,
          costo_unitario: parseFloat(form.costo_unitario) || 0,
        })
        toast.success('Insumo actualizado')
      } else {
        await saveInsumo({
          nombre: form.nombre,
          existencia: parseFloat(form.existencia),
          unidad: form.unidad,
          consumo_diario: parseFloat(form.consumo_diario) || 0,
          punto_reposicion: parseFloat(form.punto_reposicion) || 0,
          costo_unitario: parseFloat(form.costo_unitario) || 0,
        })
        toast.success('Insumo guardado')
      }
      await cargar()
      setForm({ nombre: '', existencia: '', unidad: 'kg', consumo_diario: '', punto_reposicion: '', costo_unitario: '' })
    } catch (e) {
      // Fallback local
      const nuevo = { ...form, id: form.id || Date.now(), dias_restantes: form.consumo_diario > 0 ? Math.floor(form.existencia / form.consumo_diario) : null }
      const lista = [...insumos.filter(i => i.nombre !== form.nombre && i.id !== form.id), nuevo]
      setInsumos(lista)
      localStorage.setItem('marquez_inventario', JSON.stringify(lista))
      setForm({ nombre: '', existencia: '', unidad: 'kg', consumo_diario: '', punto_reposicion: '', costo_unitario: '' })
      toast.success('Insumo guardado localmente')
    }
  }

  const handleEditar = (inv) => {
    setForm({
      id: inv.id,
      nombre: inv.nombre,
      existencia: inv.existencia,
      unidad: inv.unidad,
      consumo_diario: inv.consumo_diario || '',
      punto_reposicion: inv.punto_reposicion || '',
      costo_unitario: inv.costo_unitario || ''
    })
  }

  const handleEliminar = async (id, nombre) => {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return
    try {
      await deleteInsumo(id)
      await cargar()
      toast.success('Insumo eliminado')
    } catch (e) {
      const lista = insumos.filter(i => i.id !== id)
      setInsumos(lista)
      localStorage.setItem('marquez_inventario', JSON.stringify(lista))
    }
  }

  const estadoBadge = (dias) => {
    if (dias === null || dias === undefined) return <span className="badge-gray">—</span>
    if (dias <= 3) return <span className="badge-bad flex items-center gap-1"><AlertTriangle size={10} /> Crítico</span>
    if (dias <= 7) return <span className="badge-warn">Bajo</span>
    return <span className="badge-ok">Normal</span>
  }

  const barColor = (dias) => dias <= 3 ? '#E24B4A' : dias <= 7 ? '#C29C53' : '#3B6D11'

  const criticos = insumos.filter(i => i.dias_restantes !== null && i.dias_restantes <= 3)

  return (
    <div className="max-w-4xl space-y-4">
      {criticos.length > 0 && (
        <div className="alert-bad">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-red-800">⚠ Insumos críticos — reponer inmediatamente</div>
            <div className="text-xs text-red-700 mt-0.5">{criticos.map(i => `${i.nombre} (${i.dias_restantes}d)`).join(' · ')}</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            {form.id ? <Edit2 size={14} /> : <Plus size={14} />} 
            {form.id ? 'Editar insumo' : 'Registrar insumo'}
          </h3>
          <button onClick={() => setMostrarImport(true)} className="btn-secondary text-xs py-1.5 flex items-center gap-2">
            <FileSpreadsheet size={13} /> Importar desde Excel
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <div className="form-group">
            <label className="form-label">Insumo</label>
            <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Harina" />
          </div>
          <div className="form-group">
            <label className="form-label">Existencia actual</label>
            <input type="number" value={form.existencia} onChange={e => setForm(p => ({ ...p, existencia: e.target.value }))} placeholder="50" step="0.1" />
          </div>
          <div className="form-group">
            <label className="form-label">Unidad</label>
            <select value={form.unidad} onChange={e => setForm(p => ({ ...p, unidad: e.target.value }))}>
              {['kg','g','lb','oz','L','ml','unidad'].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Consumo diario</label>
            <input type="number" value={form.consumo_diario} onChange={e => setForm(p => ({ ...p, consumo_diario: e.target.value }))} placeholder="5" step="0.1" />
          </div>
          <div className="form-group">
            <label className="form-label">Punto de reposición</label>
            <input type="number" value={form.punto_reposicion} onChange={e => setForm(p => ({ ...p, punto_reposicion: e.target.value }))} placeholder="10" step="0.1" />
          </div>
          <div className="form-group">
            <label className="form-label">Costo unitario (C$)</label>
            <input type="number" value={form.costo_unitario} onChange={e => setForm(p => ({ ...p, costo_unitario: e.target.value }))} placeholder="0" step="0.01" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleGuardar} className="btn-primary flex items-center gap-2">
            {form.id ? <Edit2 size={14} /> : <Plus size={14} />} 
            {form.id ? 'Actualizar insumo' : 'Guardar insumo'}
          </button>
          {form.id && (
            <button onClick={() => setForm({ nombre: '', existencia: '', unidad: 'kg', consumo_diario: '', punto_reposicion: '', costo_unitario: '' })} className="btn-secondary flex items-center gap-2">
              <X size={14} /> Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2"><Package size={14} /> Estado del inventario ({insumos.length} insumos)</h3>
        {loading ? (
          <div className="text-sm text-gray-400">Cargando...</div>
        ) : insumos.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">Sin insumos registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>Insumo</th><th>Existencia</th><th>Consumo/día</th><th>Días</th><th>Estado</th><th>Costo unit.</th><th></th></tr>
              </thead>
              <tbody>
                {insumos.map(inv => {
                  const dias = inv.dias_restantes
                  const pct = inv.punto_reposicion > 0 ? Math.min(100, (inv.existencia / inv.punto_reposicion) * 100) : 50
                  return (
                    <tr key={inv.id || inv.nombre}>
                      <td>
                        <div>{inv.nombre}</div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1 w-24">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: dias != null ? barColor(dias) : '#C29C53' }} />
                        </div>
                      </td>
                      <td>{inv.existencia} {inv.unidad}</td>
                      <td>{inv.consumo_diario || '—'}</td>
                      <td className="font-medium">{dias ?? '—'}</td>
                      <td>{estadoBadge(dias)}</td>
                      <td>{inv.costo_unitario > 0 ? `C$ ${parseFloat(inv.costo_unitario).toFixed(2)}` : '—'}</td>
                      <td className="whitespace-nowrap">
                        <button onClick={() => handleEditar(inv)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 mr-1"
                          title="Editar insumo">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleEliminar(inv.id, inv.nombre)}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mostrarImport && (
        <ImportExcelModal
          tipo="inventario"
          onClose={() => setMostrarImport(false)}
          onImported={cargar}
        />
      )}
    </div>
  )
}
