import { useState, useEffect } from 'react'
import {
  getInventario, saveInsumo, updateInsumo, updateInsumosPorcentaje, deleteInsumo,
  getAuditoriaInsumos,
} from '../lib/api'
import { Package, Plus, Trash2, Pencil, Check, X, Percent, RefreshCw, History, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminPinModal from '../components/AdminPinModal'

const fmtC = v => `C$ ${(parseFloat(v) || 0).toFixed(2)}`

export default function Inventario() {
  const [insumos, setInsumos] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ 
    nombre: '', existencia: '', unidad: 'kg', consumo_diario: '', punto_reposicion: '', costo_unitario: '', densidad_g_ml: '' 
  })
  const [editandoId, setEditandoId] = useState(null)
  const [editandoInsumoId, setEditandoInsumoId] = useState(null)
  const [costoTmp, setCostoTmp] = useState('')
  const [panelMasivo, setPanelMasivo] = useState(false)
  const [pctMasivo, setPctMasivo] = useState('')
  const [pinAccion, setPinAccion] = useState(null)
  const [panelAuditoria, setPanelAuditoria] = useState(false)
  const [auditoria, setAuditoria] = useState([])

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

  const handleCancelarEdicion = () => {
    setEditandoInsumoId(null)
    setForm({ nombre: '', existencia: '', unidad: 'kg', consumo_diario: '', punto_reposicion: '', costo_unitario: '', densidad_g_ml: '' })
  }

  const handleEditarFila = (ins) => {
    setEditandoInsumoId(ins.id)
    setForm({
      nombre: ins.nombre,
      existencia: String(ins.existencia),
      unidad: ins.unidad,
      consumo_diario: String(ins.consumo_diario || 0),
      punto_reposicion: String(ins.punto_reposicion || 0),
      costo_unitario: String(ins.costo_unitario || 0),
      densidad_g_ml: ins.densidad_g_ml ? String(ins.densidad_g_ml) : ''
    })
  }

  const handleGuardar = async () => {
    if (!form.nombre || !form.existencia) { toast.error('Nombre y existencia son requeridos'); return }
    const payload = {
      nombre: form.nombre,
      existencia: parseFloat(form.existencia),
      unidad: form.unidad,
      consumo_diario: parseFloat(form.consumo_diario) || 0,
      punto_reposicion: parseFloat(form.punto_reposicion) || 0,
      costo_unitario: parseFloat(form.costo_unitario) || 0,
      densidad_g_ml: form.densidad_g_ml ? parseFloat(form.densidad_g_ml) : null
    }

    if (editandoInsumoId) {
      setPinAccion(() => async (pin) => {
        try {
          await updateInsumo(editandoInsumoId, payload, pin)
          await cargar()
          handleCancelarEdicion()
          toast.success('Insumo actualizado')
        } catch (e) {
          toast.error(e.response?.data?.error || 'No se pudo actualizar el insumo')
        }
      })
    } else {
      try {
        await saveInsumo(payload)
        await cargar()
        handleCancelarEdicion()
        toast.success('Insumo guardado')
      } catch (e) {
        toast.error(e.response?.data?.error || 'Error al guardar insumo')
      }
    }
  }

  const handleEliminar = async (id, nombre) => {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return
    try {
      const { data } = await deleteInsumo(id)
      await cargar()
      toast.success(data.mensaje || 'Insumo eliminado')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al eliminar insumo')
    }
  }

  const empezarEdicionCosto = (insumo) => {
    setEditandoId(insumo.id)
    setCostoTmp(String(insumo.costo_unitario || 0))
  }

  const confirmarCosto = (insumo) => {
    const nuevoCosto = parseFloat(costoTmp)
    if (nuevoCosto < 0 || Number.isNaN(nuevoCosto)) { toast.error('Costo inválido'); return }

    setPinAccion(() => async (pin) => {
      try {
        await updateInsumo(insumo.id, {
          existencia: insumo.existencia,
          consumo_diario: insumo.consumo_diario,
          punto_reposicion: insumo.punto_reposicion,
          costo_unitario: nuevoCosto,
        }, pin)
        await cargar()
        toast.success(`${insumo.nombre} costo actualizado`)
      } catch (e) {
        toast.error(e.response?.data?.error || 'No se pudo guardar el costo')
      } finally {
        setEditandoId(null)
      }
    })
  }

  const cancelarEdicionCosto = () => setEditandoId(null)

  const confirmarMasivo = () => {
    const pct = parseFloat(pctMasivo)
    if (!pct && pct !== 0) { toast.error('Ingresa un porcentaje'); return }
    const verbo = pct >= 0 ? 'subir' : 'bajar'
    if (!confirm(`¿Vas a ${verbo} ${Math.abs(pct)}% el costo de TODOS los insumos?`)) return

    setPinAccion(() => async (pin) => {
      try {
        const { data } = await updateInsumosPorcentaje(pct, pin)
        toast.success(`${data.actualizados} insumos actualizados`)
        await cargar()
        setPanelMasivo(false)
        setPctMasivo('')
      } catch (e) {
        toast.error(e.response?.data?.error || 'Ajuste masivo fallido')
      }
    })
  }

  const verAuditoria = async () => {
    try {
      const { data } = await getAuditoriaInsumos(40)
      setAuditoria(data)
      setPanelAuditoria(true)
    } catch (e) {
      toast.error('No se pudo cargar la auditoría')
    }
  }

  const barColor = d => {
    if (d <= 3) return '#EF4444'
    if (d <= 7) return '#F59E0B'
    return '#10B981'
  }

  const estadoBadge = (dias) => {
    if (dias === null || dias === undefined) return <span className="badge-gray">Sin datos</span>
    if (dias <= 3) return <span className="badge-bad flex items-center gap-1"><AlertTriangle size={10} /> Crítico</span>
    if (dias <= 7) return <span className="badge-warn">Bajo</span>
    return <span className="badge-ok">Suficiente</span>
  }

  return (
    <div className="space-y-4">
      {insumos.filter(i => i.dias_restantes !== null && i.dias_restantes <= 3).length > 0 && (
        <div className="alert-bad">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-red-800">⚠ Insumos críticos — reponer inmediatamente</div>
            <div className="text-xs text-red-700 mt-0.5">
              {insumos.filter(i => i.dias_restantes !== null && i.dias_restantes <= 3)
                .map(i => `${i.nombre} (${i.dias_restantes}d)`).join(' · ')}
            </div>
          </div>
        </div>
      )}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          {editandoInsumoId ? 'Editar Insumo de Inventario' : 'Registrar Nuevo Insumo'}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div className="form-group">
            <label className="form-label">Insumo</label>
            <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Harina" />
          </div>
          <div className="form-group">
            <label className="form-label">Existencia actual</label>
            <input type="number" value={form.existencia} onChange={e => setForm(p => ({ ...p, existencia: e.target.value }))} placeholder="50" step="0.001" />
          </div>
          <div className="form-group">
            <label className="form-label">Unidad</label>
            <select value={form.unidad} onChange={e => setForm(p => ({ ...p, unidad: e.target.value }))}>
              {['kg','g','lb','L','ml','unidad'].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Densidad (g/ml - opcional)</label>
            <input type="number" value={form.densidad_g_ml} onChange={e => setForm(p => ({ ...p, densidad_g_ml: e.target.value }))} placeholder="Ej: 1.0 (leche)" step="0.001" />
          </div>
          <div className="form-group">
            <label className="form-label">Consumo diario</label>
            <input type="number" value={form.consumo_diario} onChange={e => setForm(p => ({ ...p, consumo_diario: e.target.value }))} placeholder="5" step="0.001" />
          </div>
          <div className="form-group">
            <label className="form-label">Punto de reposición</label>
            <input type="number" value={form.punto_reposicion} onChange={e => setForm(p => ({ ...p, punto_reposicion: e.target.value }))} placeholder="10" step="0.001" />
          </div>
          <div className="form-group">
            <label className="form-label">Costo unitario (C$)</label>
            <input type="number" value={form.costo_unitario} onChange={e => setForm(p => ({ ...p, costo_unitario: e.target.value }))} placeholder="0" step="0.0001" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleGuardar} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> {editandoInsumoId ? 'Actualizar insumo' : 'Guardar insumo'}
          </button>
          {editandoInsumoId && (
            <button onClick={handleCancelarEdicion} className="btn-secondary">Cancelar</button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-medium text-gray-600 flex items-center gap-2"><Package size={14} /> Estado del inventario ({insumos.length} insumos)</h3>
          <div className="flex gap-2">
            <button onClick={verAuditoria} className="btn-secondary flex items-center gap-1.5 text-xs whitespace-nowrap">
              <History size={13} /> Historial de cambios
            </button>
            <button onClick={() => setPanelMasivo(p => !p)} className="btn-secondary flex items-center gap-1.5 text-xs whitespace-nowrap">
              <Percent size={13} /> Ajuste masivo
            </button>
          </div>
        </div>

        {panelMasivo && (
          <div className="rounded-xl p-3 mb-3" style={{ border: '0.5px solid #C29C53', background: '#FBF6EC' }}>
            <p className="text-xs font-medium text-gray-700 mb-2">Ajustar costo de TODOS los insumos por porcentaje</p>
            <div className="flex gap-2 items-end">
              <input type="number" value={pctMasivo} onChange={e => setPctMasivo(e.target.value)}
                placeholder="Ej: 8 (sube 8%) o -5 (baja 5%)" step="0.5" className="flex-1" />
              <button onClick={confirmarMasivo} className="btn-primary flex items-center gap-1.5 text-xs whitespace-nowrap">
                <RefreshCw size={12} /> Aplicar
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">Requiere PIN de administrador. Útil cuando un proveedor sube precios de forma general.</p>
          </div>
        )}

        {panelAuditoria && (
          <div className="rounded-xl p-3 mb-3 border border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-medium text-gray-700">Últimos cambios de costo</p>
              <button onClick={() => setPanelAuditoria(false)} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>
            {auditoria.length === 0 ? (
              <p className="text-xs text-gray-400">Sin cambios registrados todavía.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base text-xs">
                  <thead><tr><th>Fecha</th><th>Insumo</th><th className="text-right">Antes</th><th className="text-right">Ahora</th><th>Método</th></tr></thead>
                  <tbody>
                    {auditoria.map(a => (
                      <tr key={a.id}>
                        <td className="text-gray-500">{new Date(a.creado_en).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td>{a.entidad_nombre}</td>
                        <td className="text-right text-gray-400">{fmtC(a.valor_anterior)}</td>
                        <td className="text-right font-medium" style={{ color: '#C29C53' }}>{fmtC(a.valor_nuevo)}</td>
                        <td><span className="badge-gray">{a.metodo === 'individual' ? 'Individual' : a.metodo === 'masivo_lista' ? 'Masivo' : `${a.porcentaje_aplicado > 0 ? '+' : ''}${a.porcentaje_aplicado}%`}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-400">Cargando...</div>
        ) : insumos.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">Sin insumos registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>Insumo</th><th>Existencia</th><th>Consumo/día</th><th>Días</th><th>Estado</th><th>Costo unit.</th><th>Densidad</th><th></th></tr>
              </thead>
              <tbody>
                {insumos.map(inv => {
                  const dias = inv.dias_restantes
                  const pct = inv.punto_reposicion > 0 ? Math.min(100, (inv.existencia / inv.punto_reposicion) * 100) : 50
                  return (
                    <tr key={inv.id || inv.nombre}>
                      <td>
                        <div className="font-semibold text-gray-700">{inv.nombre}</div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1 w-24">
                           <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: dias != null ? barColor(dias) : '#C29C53' }} />
                        </div>
                      </td>
                      <td>{parseFloat(inv.existencia).toFixed(2)} {inv.unidad}</td>
                      <td>{inv.consumo_diario ? parseFloat(inv.consumo_diario).toFixed(2) : '—'}</td>
                      <td className="font-medium">{dias ?? '—'}</td>
                      <td>{estadoBadge(dias)}</td>
                      <td>
                        {editandoId === inv.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number" autoFocus value={costoTmp}
                              onChange={e => setCostoTmp(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') confirmarCosto(inv)
                                if (e.key === 'Escape') cancelarEdicionCosto()
                              }}
                              className="w-20 py-0.5 text-xs"
                              step="0.0001"
                            />
                            <button onClick={() => confirmarCosto(inv)} className="p-1 rounded hover:bg-green-50 text-green-600">
                              <Check size={12} />
                            </button>
                            <button onClick={cancelarEdicionCosto} className="p-1 rounded hover:bg-red-50 text-red-500">
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => empezarEdicionCosto(inv)} className="flex items-center gap-1 group">
                            <span>{inv.costo_unitario > 0 ? fmtC(inv.costo_unitario) : '—'}</span>
                            <Pencil size={10} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                          </button>
                        )}
                      </td>
                      <td className="text-gray-500 text-xs">{inv.densidad_g_ml ? `${inv.densidad_g_ml} g/ml` : '—'}</td>
                      <td className="flex items-center gap-1">
                        <button onClick={() => handleEditarFila(inv)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-600 transition-colors"
                          title="Editar insumo"
                        >
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleEliminar(inv.id, inv.nombre)}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="Eliminar insumo"
                        >
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

      <AdminPinModal
        abierto={!!pinAccion}
        onCerrar={() => { setPinAccion(null); setEditandoId(null) }}
        onConfirmar={(pin) => { pinAccion?.(pin); setPinAccion(null) }}
      />
    </div>
  )
}
