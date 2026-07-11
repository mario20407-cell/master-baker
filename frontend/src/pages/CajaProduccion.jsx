import { useState, useEffect } from 'react'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { ChefHat, Check, Package } from 'lucide-react'

const HOY = new Date().toISOString().slice(0, 10)

export default function CajaProduccion() {
  const [lotes, setLotes]       = useState([])
  const [cargando, setCargando] = useState(true)
  const [fecha, setFecha]       = useState(HOY)
  const [editando, setEditando] = useState(null) // lote_id siendo editado en caja

  const cargar = async () => {
    setCargando(true)
    try {
      const { data } = await api.get('/lotes', { params: { fecha } })
      setLotes(data)
    } catch { toast.error('Error al cargar lotes') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [fecha])

  const actualizarCaja = async (loteId, campos) => {
    try {
      await api.patch(`/lotes/${loteId}/caja`, campos)
      toast.success('Caja actualizada')
      setEditando(null)
      cargar()
    } catch { toast.error('Error al actualizar caja') }
  }

  const totalDia = lotes.reduce((s, l) => s + Number(l.total_vendido || 0), 0)
  const totalMerma = lotes.reduce((s, l) => s + Number(l.merma || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Caja de Producción</h1>
          <p className="text-xs text-gray-500">Registro de hornadas y ventas del día</p>
        </div>
      </div>

      {/* Selector de fecha + resumen */}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5" />
        <div className="flex gap-4 text-sm">
          <span className="text-gray-500">Vendido: <strong className="text-green-600">C$ {totalDia.toFixed(2)}</strong></span>
          <span className="text-gray-500">Merma total: <strong className="text-red-500">{totalMerma} uds</strong></span>
        </div>
      </div>

      {/* Lista de lotes */}
      {cargando ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : lotes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ChefHat size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay hornadas registradas para esta fecha</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lotes.map(l => (
            <LoteCard key={l.id} lote={l} editando={editando === l.id}
              onEditar={() => setEditando(l.id)}
              onGuardar={(campos) => actualizarCaja(l.id, campos)}
              onCancelar={() => setEditando(null)} />
          ))}
        </div>
      )}
    </div>
  )
}

function LoteCard({ lote, editando, onEditar, onGuardar, onCancelar }) {
  const [vendida, setVendida] = useState(String(lote.vendido || 0))
  const [merma, setMerma]     = useState(String(lote.merma || 0))
  const [precio, setPrecio]   = useState(String(lote.caja?.precio_unitario || lote.precio_unitario || 0))

  const disponible = lote.cantidad - Number(vendida) - Number(merma)
  const pct = lote.cantidad > 0 ? Math.round((Number(vendida) / lote.cantidad) * 100) : 0

  return (
    <div className={`bg-white rounded-xl border p-4 ${lote.cerrado ? 'border-green-200 bg-green-50/30' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Package size={15} className="text-gray-400" />
            <span className="font-medium text-gray-800">{lote.producto}</span>
            {lote.cerrado && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Cerrado</span>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {lote.cantidad} {lote.unidad} producidas · C$ {Number(lote.costo_total || 0).toFixed(2)} costo
          </p>
        </div>
        <div className="flex gap-1">
          {!lote.cerrado && !editando && (
            <button onClick={onEditar} className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">Actualizar</button>
          )}
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>Vendido: {lote.vendido} ({pct}%)</span>
        <span>Disponible: {disponible}</span>
        <span>Merma: {lote.merma}</span>
      </div>

      {/* Formulario inline de actualización */}
      {editando && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-gray-500">Vendidas</label>
            <input type="number" value={vendida} onChange={e => setVendida(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 mt-0.5" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Merma</label>
            <input type="number" value={merma} onChange={e => setMerma(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 mt-0.5" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Precio C$</label>
            <input type="number" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 mt-0.5" />
          </div>
          <div className="col-span-3 flex gap-2 mt-1">
            <button onClick={() => onGuardar({ cantidad_vendida: Number(vendida), cantidad_merma: Number(merma), precio_unitario: Number(precio) })}
              className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600">
              <Check size={13} /> Guardar
            </button>
            <button onClick={() => onGuardar({ cantidad_vendida: Number(vendida), cantidad_merma: Number(merma), precio_unitario: Number(precio), cerrado: true })}
              className="flex-1 text-xs py-1.5 rounded-lg bg-gray-800 text-white hover:bg-gray-900">
              Cerrar caja
            </button>
            <button onClick={onCancelar} className="px-3 text-xs py-1.5 rounded-lg bg-gray-100 text-gray-600">Cancelar</button>
          </div>
        </div>
      )}

      {!editando && (
        <p className="text-xs font-medium text-green-700 mt-2">
          Total vendido: C$ {Number(lote.total_vendido || 0).toFixed(2)}
        </p>
      )}
    </div>
  )
}
