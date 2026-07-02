import { useState, useEffect, useMemo } from 'react'
import { Search, Plus, Minus, X, ShoppingCart, CreditCard, Banknote, ArrowLeftRight } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { PRODUCTOS, CATEGORIAS } from '../lib/catalogo'

const METODOS = [
  { id: 'efectivo',      label: 'Efectivo',     icon: Banknote },
  { id: 'tarjeta',       label: 'Tarjeta',       icon: CreditCard },
  { id: 'transferencia', label: 'Transferencia', icon: ArrowLeftRight },
]

export default function Ventas() {
  const [sucursales, setSucursales] = useState([])
  const [sucursalId, setSucursalId] = useState('')
  const [busqueda, setBusqueda]     = useState('')
  const [categoria, setCategoria]   = useState('')
  const [carrito, setCarrito]       = useState([])
  const [metodo, setMetodo]         = useState('efectivo')
  const [cargando, setCargando]     = useState(false)

  useEffect(() => {
    api.get('/sucursales').then(({ data }) => {
      setSucursales(data)
      if (data.length === 1) setSucursalId(data[0].id)
    }).catch(() => toast.error('Error al cargar sucursales'))
  }, [])

  const productosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase()
    return PRODUCTOS.filter(p =>
      (!q || p.n.toLowerCase().includes(q)) &&
      (!categoria || p.cat === categoria)
    )
  }, [busqueda, categoria])

  const agregarAlCarrito = (prod) => {
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.producto === prod.n)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], cantidad: next[idx].cantidad + 1 }
        return next
      }
      return [...prev, { producto: prod.n, cantidad: 1, precio_unit: prod.p }]
    })
  }

  const actualizarCantidad = (idx, delta) => {
    setCarrito(prev => {
      const next = [...prev]
      const nueva = next[idx].cantidad + delta
      if (nueva <= 0) return prev.filter((_, i) => i !== idx)
      next[idx] = { ...next[idx], cantidad: nueva }
      return next
    })
  }

  const actualizarPrecio = (idx, valor) => {
    setCarrito(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], precio_unit: parseFloat(valor) || 0 }
      return next
    })
  }

  const eliminarItem = (idx) => setCarrito(prev => prev.filter((_, i) => i !== idx))

  const total = carrito.reduce((s, i) => s + i.cantidad * i.precio_unit, 0)

  const registrar = async () => {
    if (!sucursalId)          return toast.error('Selecciona una sucursal')
    if (carrito.length === 0) return toast.error('El carrito está vacío')

    setCargando(true)
    try {
      await api.post('/ventas', {
        sucursal_id: sucursalId,
        items: carrito.map(i => ({ producto: i.producto, cantidad: i.cantidad, precio_unit: i.precio_unit })),
        total,
        metodo_pago: metodo,
        canal: 'tienda',
      })
      toast.success('Venta registrada')
      setCarrito([])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al registrar venta')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex gap-4" style={{ height: 'calc(100vh - 120px)' }}>

      {/* ── Catálogo ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-hidden">
        <div className="flex gap-2 flex-shrink-0">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <select
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">Todas</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 content-start">
          {productosFiltrados.map(prod => (
            <button
              key={prod.n}
              onClick={() => agregarAlCarrito(prod)}
              className="text-left p-3 rounded-xl border border-gray-100 bg-white hover:border-amber-300 hover:shadow-sm transition-all group"
            >
              <div className="text-xs text-gray-400 mb-0.5">{prod.cat}</div>
              <div className="text-sm font-medium text-gray-800 leading-tight">{prod.n}</div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-bold text-amber-600">C$ {prod.p}</span>
                <span className="text-gray-300 group-hover:text-amber-500 transition-colors">
                  <Plus size={16} />
                </span>
              </div>
            </button>
          ))}
          {productosFiltrados.length === 0 && (
            <p className="col-span-full text-sm text-gray-400 py-8 text-center">Sin resultados</p>
          )}
        </div>
      </div>

      {/* ── Carrito ────────────────────────────────────────────── */}
      <div className="w-80 flex flex-col gap-3 flex-shrink-0 overflow-hidden">

        {/* Sucursal */}
        <div className="flex-shrink-0">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Sucursal</label>
          <select
            value={sucursalId}
            onChange={e => setSucursalId(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">Seleccionar sucursal…</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {carrito.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-300">
              <ShoppingCart size={32} className="mb-2" />
              <p className="text-xs">Agrega productos al carrito</p>
            </div>
          ) : (
            carrito.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white rounded-lg border border-gray-100 px-2 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{item.producto}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-gray-400">C$</span>
                    <input
                      type="number"
                      min="0"
                      value={item.precio_unit}
                      onChange={e => actualizarPrecio(idx, e.target.value)}
                      className="w-14 text-xs border border-gray-200 rounded px-1 py-0.5 text-right"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => actualizarCantidad(idx, -1)}
                    className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                    <Minus size={10} />
                  </button>
                  <span className="w-6 text-center text-sm font-medium">{item.cantidad}</span>
                  <button onClick={() => actualizarCantidad(idx, +1)}
                    className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                    <Plus size={10} />
                  </button>
                </div>
                <div className="text-xs font-semibold text-gray-700 w-12 text-right">
                  {(item.cantidad * item.precio_unit).toFixed(0)}
                </div>
                <button onClick={() => eliminarItem(idx)} className="text-gray-300 hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer: total + método + botón */}
        <div className="border-t border-gray-100 pt-3 flex-shrink-0">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-500">Total</span>
            <span className="text-xl font-bold text-gray-800">C$ {total.toFixed(2)}</span>
          </div>

          <div className="flex gap-1 mb-3">
            {METODOS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setMetodo(id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                  metodo === id
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={registrar}
            disabled={cargando || carrito.length === 0 || !sucursalId}
            className="w-full btn-primary py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cargando ? 'Registrando…' : 'Registrar venta'}
          </button>
        </div>
      </div>
    </div>
  )
}
