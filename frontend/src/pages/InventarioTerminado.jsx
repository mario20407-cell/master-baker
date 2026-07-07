import { useState, useEffect } from 'react'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { Plus, Package, ArrowRightLeft, X, AlertTriangle, ChevronDown } from 'lucide-react'

export default function InventarioTerminado() {
  const [inventario, setInventario]   = useState([])
  const [sucursales, setSucursales]   = useState([])
  const [lotes, setLotes]             = useState([])
  const [cargando, setCargando]       = useState(true)
  const [filtroSucursal, setFiltro]   = useState('')
  const [modalDist, setModalDist]     = useState(false)
  const [modalSucursal, setModalSucursal] = useState(false)
  const [formSucursal, setFormSucursal]   = useState({ nombre: '', direccion: '' })
  const [dist, setDist] = useState({ lote_id: '', distribuciones: [] })

  const cargar = async () => {
    setCargando(true)
    try {
      const [inv, suc, lot] = await Promise.all([
        api.get('/inventario-terminado'),
        api.get('/sucursales'),
        api.get('/lotes'),
      ])
      setInventario(inv.data)
      setSucursales(suc.data)
      setLotes(lot.data)
    } catch { toast.error('Error al cargar inventario') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [])

  const abrirDistribuir = () => {
    setDist({ lote_id: '', distribuciones: sucursales.map(s => ({ sucursal_id: s.id, nombre: s.nombre, cantidad: '' })) })
    setModalDist(true)
  }

  const distribuir = async (e) => {
    e.preventDefault()
    const distFiltradas = dist.distribuciones.filter(d => Number(d.cantidad) > 0)
    if (!dist.lote_id) return toast.error('Selecciona un lote')
    if (distFiltradas.length === 0) return toast.error('Ingresa al menos una cantidad')
    try {
      await api.post('/inventario-terminado/distribuir', {
        lote_id: dist.lote_id,
        distribuciones: distFiltradas.map(d => ({ sucursal_id: d.sucursal_id, cantidad: Number(d.cantidad) })),
      })
      toast.success('Lote distribuido')
      setModalDist(false)
      cargar()
    } catch (err) { toast.error(err.response?.data?.error || 'Error al distribuir') }
  }

  const crearSucursal = async (e) => {
    e.preventDefault()
    try {
      await api.post('/sucursales', formSucursal)
      toast.success('Sucursal creada')
      setModalSucursal(false)
      setFormSucursal({ nombre: '', direccion: '' })
      cargar()
    } catch (err) { toast.error(err.response?.data?.error || 'Error al crear sucursal') }
  }

  const ajustarStockMinimo = async (id, valor) => {
    try {
      await api.patch(`/inventario-terminado/${id}`, { stock_minimo: Number(valor) })
      setInventario(inv => inv.map(i => i.id === id ? { ...i, stock_minimo: valor } : i))
    } catch { toast.error('Error al actualizar') }
  }

  const invFiltrado = filtroSucursal
    ? inventario.filter(i => i.sucursal_id === filtroSucursal)
    : inventario

  const bajoMinimo = invFiltrado.filter(i => Number(i.stock) <= Number(i.stock_minimo) && Number(i.stock_minimo) > 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Inventario Terminado</h1>
          <p className="text-xs text-gray-500">Stock de producto por sucursal</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModalSucursal(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
            <Plus size={14} /> Sucursal
          </button>
          <button onClick={abrirDistribuir}
            className="btn-primary flex items-center gap-1.5 text-sm">
            <ArrowRightLeft size={14} /> Distribuir lote
          </button>
        </div>
      </div>

      {/* Alertas bajo mínimo */}
      {bajoMinimo.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-700">
            <strong>Stock bajo:</strong> {bajoMinimo.map(i => `${i.producto} (${i.sucursal_nombre})`).join(', ')}
          </div>
        </div>
      )}

      {/* Filtro por sucursal */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFiltro('')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${!filtroSucursal ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          Todas
        </button>
        {sucursales.map(s => (
          <button key={s.id} onClick={() => setFiltro(s.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filtroSucursal === s.id ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {s.nombre}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {cargando ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : invFiltrado.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin stock registrado</p>
          <p className="text-xs mt-1">Distribuye un lote para agregar productos al inventario</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                <th className="text-left px-4 py-3">Producto</th>
                <th className="text-left px-4 py-3">Sucursal</th>
                <th className="text-right px-4 py-3">Stock</th>
                <th className="text-right px-4 py-3">Mínimo</th>
                <th className="text-right px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {invFiltrado.map(item => (
                <FilaInventario key={item.id} item={item} onActualizar={ajustarStockMinimo} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal distribuir lote */}
      {modalDist && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Distribuir lote</h2>
              <button onClick={() => setModalDist(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <form onSubmit={distribuir} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Lote / Hornada</label>
                <select value={dist.lote_id} onChange={e => setDist(d => ({...d, lote_id: e.target.value}))} required>
                  <option value="">Seleccionar...</option>
                  {lotes.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.producto} — {l.cantidad} {l.unidad} ({new Date(l.fecha).toLocaleDateString('es-NI')})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="form-label mb-2">Cantidad por sucursal</p>
                <div className="space-y-2">
                  {dist.distribuciones.map((d, i) => (
                    <div key={d.sucursal_id} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 flex-1">{d.nombre}</span>
                      <input type="number" min="0" value={d.cantidad}
                        onChange={e => setDist(prev => ({
                          ...prev,
                          distribuciones: prev.distribuciones.map((x, xi) => xi === i ? {...x, cantidad: e.target.value} : x)
                        }))}
                        className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-right"
                        placeholder="0" />
                    </div>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn-primary w-full">Distribuir</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal nueva sucursal */}
      {modalSucursal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Nueva sucursal</h2>
              <button onClick={() => setModalSucursal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <form onSubmit={crearSucursal} className="space-y-3">
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input value={formSucursal.nombre} onChange={e => setFormSucursal(f => ({...f, nombre: e.target.value}))}
                  placeholder="Ej: Sucursal Norte" required />
              </div>
              <div className="form-group">
                <label className="form-label">Dirección</label>
                <input value={formSucursal.direccion} onChange={e => setFormSucursal(f => ({...f, direccion: e.target.value}))}
                  placeholder="Opcional" />
              </div>
              <button type="submit" className="btn-primary w-full">Crear sucursal</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function FilaInventario({ item, onActualizar }) {
  const [editMin, setEditMin] = useState(false)
  const [minVal, setMinVal]   = useState(String(item.stock_minimo))
  const bajo = Number(item.stock) <= Number(item.stock_minimo) && Number(item.stock_minimo) > 0
  const agotado = Number(item.stock) === 0

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="px-4 py-3 font-medium text-gray-800">{item.producto}</td>
      <td className="px-4 py-3 text-gray-500">{item.sucursal_nombre}</td>
      <td className="px-4 py-3 text-right font-semibold">
        <span className={agotado ? 'text-red-500' : bajo ? 'text-amber-500' : 'text-gray-800'}>
          {item.stock} {item.unidad}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {editMin ? (
          <input type="number" min="0" value={minVal}
            className="w-16 text-sm border border-gray-200 rounded px-1.5 py-0.5 text-right"
            onBlur={() => { onActualizar(item.id, minVal); setEditMin(false) }}
            onChange={e => setMinVal(e.target.value)}
            autoFocus />
        ) : (
          <button onClick={() => setEditMin(true)} className="text-gray-400 hover:text-gray-700 flex items-center gap-1 ml-auto">
            {item.stock_minimo} <ChevronDown size={11} />
          </button>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {agotado
          ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Agotado</span>
          : bajo
          ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">Bajo</span>
          : <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600">OK</span>
        }
      </td>
    </tr>
  )
}
