import { useState, useCallback } from 'react'
import { useVentas } from '../hooks/useVentas'
import { useCatalogo } from '../hooks/useCatalogo'
import { ShoppingCart, Receipt, BarChart2, Calculator, Search, Plus, Minus, Trash2, CheckCircle, AlertTriangle, Download } from 'lucide-react'
import toast from 'react-hot-toast'

const fmt   = v => 'C$ ' + (parseFloat(v) || 0).toFixed(2)
const n     = v => parseFloat(v) || 0

// ── Helpers de fecha ──────────────────────────────────────────────────────────
const HOY_DISPLAY = () => new Date().toLocaleDateString('es-NI')
const HOY_ISO     = () => new Date().toISOString().slice(0, 10)
// Bug 4 fix: nombre de archivo sin barras
const HOY_FILE    = () => new Date().toISOString().slice(0, 10)

// ── Normalizador de venta ─────────────────────────────────────────────────────
// Bug 1,2,3 fix: unifica campos sin importar si la venta viene de la API
// (metodo_pago, producto, cantidad) o del estado local (metodo, n, qty).
function normVenta(v) {
  return {
    ...v,
    metodo_pago: v.metodo_pago || v.metodo || 'efectivo',
    items: (v.items || []).map(i => ({
      ...i,
      nombre:    i.producto  || i.n    || '—',
      cantidad:  i.cantidad  ?? i.qty  ?? 1,
      precio:    parseFloat(i.precio_unit || i.p || 0),
      subtotal:  parseFloat(i.subtotal || 0) || (parseFloat(i.precio_unit || i.p || 0) * (i.cantidad ?? i.qty ?? 1)),
    })),
  }
}

// ── Subcomponentes ────────────────────────────────────────────────────────────
function CatalogoGrid({ onAdd, productos }) {
  const [q,   setQ]   = useState('')
  const [cat, setCat] = useState('Todos')

  const CATS = ['Todos', ...[...new Set(productos.map(p => p.categoria))].sort()]

  const lista = productos.filter(p =>
    (cat === 'Todos' || p.categoria === cat) &&
    (!q || p.nombre.toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Seleccionar productos</h3>
      <div className="relative mb-3">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="pl-8" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar producto..." />
      </div>
      <div className="flex gap-1.5 flex-wrap mb-3">
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className="px-2 py-1 text-[10px] rounded-md border transition-all"
            style={{ background: c === cat ? '#C29C53' : 'transparent', color: c === cat ? '#fff' : 'var(--color-text-secondary)', borderColor: c === cat ? '#C29C53' : 'var(--color-border-tertiary)' }}>
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
        {lista.map(p => (
          <button key={p.nombre} onClick={() => onAdd(p)}
            className="text-left p-2 rounded-lg border border-gray-100 hover:border-amber-400 bg-gray-50 hover:bg-amber-50 transition-all">
            <div className="text-xs font-medium text-gray-800 leading-tight mb-1">{p.nombre}</div>
            <div className="text-sm font-semibold" style={{ color: '#C29C53' }}>{fmt(p.precio)}</div>
            <div className="text-[10px] text-gray-400">{p.categoria}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function Carrito({ items, onChange, onLimpiar }) {
  const total = items.reduce((s, i) => s + i.p * i.qty, 0)

  const cambiarQty = (idx, d) => {
    const nuevo = items.map((it, i) => i === idx ? { ...it, qty: it.qty + d } : it).filter(it => it.qty > 0)
    onChange(nuevo)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <ShoppingCart size={14} /> Carrito
        </h3>
        {items.length > 0 && (
          <button onClick={onLimpiar} className="btn-danger btn-sm flex items-center gap-1">
            <Trash2 size={11} /> Vaciar
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-xs">
          <ShoppingCart size={28} className="mx-auto mb-2 opacity-40" />
          Agrega productos del catálogo
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
              <span className="flex-1 text-xs text-gray-800 leading-tight">{it.n}</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => cambiarQty(i, -1)}
                  className="w-5 h-5 rounded-full border border-gray-200 flex items-center justify-center text-xs hover:bg-gray-100">
                  <Minus size={10} />
                </button>
                <span className="text-xs font-medium w-4 text-center">{it.qty}</span>
                <button onClick={() => cambiarQty(i, 1)}
                  className="w-5 h-5 rounded-full border border-gray-200 flex items-center justify-center text-xs hover:bg-gray-100">
                  <Plus size={10} />
                </button>
              </div>
              <span className="text-xs font-medium text-gray-900 w-16 text-right">{fmt(it.p * it.qty)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg p-3 flex justify-between items-center mb-3"
        style={{ background: 'var(--color-background-secondary)' }}>
        <span className="text-sm font-medium text-gray-800">Total</span>
        <span className="text-xl font-semibold" style={{ color: '#C29C53' }}>{fmt(total)}</span>
      </div>
    </div>
  )
}

function Ticket({ venta }) {
  if (!venta) return null
  const v = normVenta(venta)
  return (
    <div className="card border-green-200 mt-3">
      <div className="text-center mb-3">
        <Receipt size={18} className="mx-auto mb-1" style={{ color: '#C29C53' }} />
        <div className="text-xs font-medium text-gray-800">Ticket de venta</div>
        <div className="text-[10px] text-gray-400">{v.fecha} {v.hora} — {v.canal}</div>
      </div>
      <table className="table-base text-xs mb-2">
        <thead><tr><th>Producto</th><th className="text-right">Cant.</th><th className="text-right">Subtotal</th></tr></thead>
        <tbody>
          {v.items.map((it, i) => (
            <tr key={i}>
              <td>{it.nombre}</td>
              <td className="text-right">{it.cantidad}</td>
              <td className="text-right">{fmt(it.precio * it.cantidad)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
        <span className="text-xs font-medium">Total</span>
        <span className="text-base font-semibold" style={{ color: '#C29C53' }}>{fmt(v.total)}</span>
      </div>
      <div className="text-[10px] text-gray-400 mt-1">Pago: {v.metodo_pago} · {v.cliente}</div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Ventas() {
  const [tab,       setTab]       = useState('venta')
  const [cajaFisico, setCajaFisico] = useState('')  // fix: estado persistente entre tabs

  const { ventas: ventasRaw, resumen, registrar, anular, loading: ventaLoading, apiOnline } = useVentas()
  const { productos } = useCatalogo()

  // Normalizar todas las ventas al montar y cuando cambian
  const ventas = ventasRaw.map(normVenta)

  const [carrito,   setCarrito]   = useState([])
  const [metodo,    setMetodo]    = useState('efectivo')
  const [canal,     setCanal]     = useState('tienda')
  const [cliente,   setCliente]   = useState('')
  const [montoRec,  setMontoRec]  = useState('')
  const [ultimaVenta, setUltimaVenta] = useState(null)

  const totalCarrito = carrito.reduce((s, i) => s + i.p * i.qty, 0)
  const cambio       = n(montoRec) - totalCarrito
  const totalHoy     = resumen?.ingresos || 0

  const addCarrito = (prod) => {
    setCarrito(prev => {
      const ex = prev.find(i => i.n === prod.nombre)
      if (ex) return prev.map(i => i.n === prod.nombre ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { n: prod.nombre, p: prod.precio, cat: prod.categoria, qty: 1 }]
    })
  }

  const registrarVenta = async () => {
    if (!carrito.length) { toast.error('Agrega al menos un producto'); return }
    const payload = {
      items:       carrito.map(i => ({ producto: i.n, cantidad: i.qty, precio_unit: i.p })),
      total:       totalCarrito,
      metodo_pago: metodo,
      canal,
      cliente:     cliente || 'Sin nombre',
    }
    const nueva = await registrar(payload)
    if (nueva) {
      setUltimaVenta({ ...nueva, items: carrito.map(i => ({ ...i })) })
      setCarrito([])
      setCliente('')
      setMontoRec('')
      toast.success('Venta registrada')
    }
  }

  // ── Cálculos del reporte (bug 2 fix: usa campos normalizados) ─────────────
  const prodCount    = {}
  const prodIngresos = {}
  ventas.forEach(v => v.items.forEach(i => {
    prodCount[i.nombre]    = (prodCount[i.nombre]    || 0) + i.cantidad
    prodIngresos[i.nombre] = (prodIngresos[i.nombre] || 0) + i.precio * i.cantidad
  }))
  const topProds = Object.entries(prodCount).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxProd  = topProds[0]?.[1] || 1

  const canalIngresos = {}
  ventas.forEach(v => { canalIngresos[v.canal] = (canalIngresos[v.canal] || 0) + parseFloat(v.total) })

  // ── Cierre de caja (bug 1 fix: usa metodo_pago normalizado) ──────────────
  const efectivo      = ventas.filter(v => v.metodo_pago === 'efectivo').reduce((s, v) => s + parseFloat(v.total), 0)
  const tarjeta       = ventas.filter(v => v.metodo_pago === 'tarjeta').reduce((s, v) => s + parseFloat(v.total), 0)
  const transferencia = ventas.filter(v => v.metodo_pago === 'transferencia').reduce((s, v) => s + parseFloat(v.total), 0)
  const diferencia    = n(cajaFisico) - efectivo

  // Bug 4 fix: nombre de archivo sin barras usando HOY_FILE (ISO)
  const exportarCierre = () => {
    let csv = '\uFEFFCierre de caja — Master Baker\n'
    csv += `Fecha,${HOY_DISPLAY()}\nTotal ventas,${ventas.length}\nIngresos totales,${totalHoy.toFixed(2)}\n\n`
    csv += 'Hora,Cliente,Canal,Pago,Total\n'
    ventas.forEach(v => {
      csv += `${v.hora},"${v.cliente}",${v.canal},${v.metodo_pago},${parseFloat(v.total).toFixed(2)}\n`
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `cierre_${HOY_FILE()}.csv`   // ej: cierre_2025-06-16.csv
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Cierre exportado')
  }

  return (
    <div className="max-w-5xl">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="kpi-card">
          <div className="text-xs text-gray-400 mb-1">Ventas hoy</div>
          <div className="text-2xl font-semibold">{resumen?.total_ventas ?? ventas.length}</div>
          {!apiOnline && <div className="text-[10px] text-amber-500 mt-1">● offline</div>}
        </div>
        <div className="kpi-card">
          <div className="text-xs text-gray-400 mb-1">Ingresos hoy</div>
          <div className="text-2xl font-semibold" style={{ color: '#C29C53' }}>{fmt(resumen?.ingresos ?? totalHoy)}</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-gray-400 mb-1">Ticket promedio</div>
          <div className="text-2xl font-semibold">{fmt(resumen?.ticket_promedio ?? 0)}</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-gray-400 mb-1">En carrito</div>
          <div className="text-2xl font-semibold">{fmt(totalCarrito)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit overflow-x-auto">
        {[['venta','Nueva venta'],['historial','Historial'],['reporte','Reporte'],['cierre','Cierre de caja']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap ${tab === v ? 'bg-white font-medium shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* NUEVA VENTA */}
      {tab === 'venta' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <CatalogoGrid onAdd={addCarrito} productos={productos} />
          <div>
            <div className="card">
              <Carrito items={carrito} onChange={setCarrito} onLimpiar={() => setCarrito([])} />
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="form-group">
                    <label className="form-label">Canal</label>
                    <select value={canal} onChange={e => setCanal(e.target.value)}>
                      <option value="tienda">Tienda física</option>
                      <option value="whatsapp">WhatsApp / delivery</option>
                      <option value="encargo">Encargo previo</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cliente</label>
                    <input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nombre (opcional)" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Método de pago</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[['efectivo','Efectivo'],['tarjeta','Tarjeta'],['transferencia','Transf.']].map(([m, l]) => (
                      <button key={m} onClick={() => setMetodo(m)}
                        className="py-2 text-xs rounded-lg border transition-all"
                        style={{ background: metodo === m ? '#C29C53' : 'transparent', color: metodo === m ? '#fff' : 'var(--color-text-secondary)', borderColor: metodo === m ? '#C29C53' : 'var(--color-border-tertiary)' }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {metodo === 'efectivo' && (
                  <div className="form-group">
                    <label className="form-label">Monto recibido</label>
                    <input type="number" value={montoRec} onChange={e => setMontoRec(e.target.value)} placeholder="0.00" step="0.01" />
                    {n(montoRec) > 0 && (
                      <div className={cambio >= 0 ? 'alert-ok mt-2' : 'alert-bad mt-2'}>
                        {cambio >= 0
                          ? <><CheckCircle size={14} className="text-green-600" /> <span className="text-xs">Cambio: {fmt(cambio)}</span></>
                          : <><AlertTriangle size={14} className="text-red-600" /> <span className="text-xs">Faltan: {fmt(Math.abs(cambio))}</span></>
                        }
                      </div>
                    )}
                  </div>
                )}

                <button onClick={registrarVenta} disabled={ventaLoading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                  style={{ opacity: ventaLoading ? 0.7 : 1 }}>
                  <CheckCircle size={14} />
                  {ventaLoading ? 'Registrando...' : 'Registrar venta'}
                </button>
              </div>
            </div>
            <Ticket venta={ultimaVenta} />
          </div>
        </div>
      )}

      {/* HISTORIAL — bug 3 fix: usa campos normalizados */}
      {tab === 'historial' && (
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-gray-700">Ventas de hoy — {HOY_DISPLAY()}</h3>
            <span className="badge-info">{ventas.length} transacciones</span>
          </div>
          {ventas.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">Sin ventas registradas hoy.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr><th>Hora</th><th>Cliente</th><th>Canal</th><th>Pago</th><th>Productos</th><th className="text-right">Total</th></tr>
                </thead>
                <tbody>
                  {[...ventas].reverse().map(v => (
                    <tr key={v.id}>
                      <td>{v.hora}</td>
                      <td>{v.cliente}</td>
                      <td><span className="badge-gray">{v.canal}</span></td>
                      <td><span className="badge-info">{v.metodo_pago}</span></td>
                      <td className="text-xs text-gray-500">
                        {v.items.map(i => `${i.nombre}×${i.cantidad}`).join(', ')}
                      </td>
                      <td className="text-right font-medium">{fmt(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* REPORTE */}
      {tab === 'reporte' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Ventas',          ventas.length,                                                          'transacciones'],
              ['Ingresos',        fmt(totalHoy),                                                          'hoy'],
              ['Piezas vendidas', ventas.reduce((s,v) => s + v.items.reduce((ss,i) => ss + i.cantidad, 0), 0), 'unidades'],
              ['Ticket promedio', fmt(ventas.length ? totalHoy / ventas.length : 0),                     'por venta'],
            ].map(([l, v, d]) => (
              <div key={l} className="kpi-card">
                <div className="text-xs text-gray-400 mb-1">{l}</div>
                <div className="text-xl font-semibold text-gray-900">{v}</div>
                <div className="text-xs text-gray-400 mt-1">{d}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Productos más vendidos</h3>
              {topProds.length === 0
                ? <div className="text-xs text-gray-400">Sin ventas aún.</div>
                : topProds.map(([nombre, qty]) => (
                  <div key={nombre} className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-600 w-32 truncate">{nombre}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(qty/maxProd*100).toFixed(0)}%`, background: '#C29C53' }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-12 text-right">{qty} pzs</span>
                  </div>
                ))
              }
            </div>
            <div className="card">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Ingresos por canal</h3>
              {Object.entries(canalIngresos).length === 0
                ? <div className="text-xs text-gray-400">Sin ventas aún.</div>
                : Object.entries(canalIngresos).map(([c, v]) => (
                  <div key={c} className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-600 w-28 truncate">{c}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${totalHoy > 0 ? (v/totalHoy*100).toFixed(0) : 0}%`, background: '#3B6D11' }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-20 text-right">{fmt(v)}</span>
                  </div>
                ))
              }
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Detalle por producto</h3>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr><th>Producto</th><th className="text-right">Piezas</th><th className="text-right">Ingresos</th><th className="text-right">% del total</th></tr>
                </thead>
                <tbody>
                  {Object.entries(prodIngresos).sort((a,b) => b[1]-a[1]).map(([nom, ing]) => (
                    <tr key={nom}>
                      <td>{nom}</td>
                      <td className="text-right">{prodCount[nom] || 0}</td>
                      <td className="text-right font-medium">{fmt(ing)}</td>
                      <td className="text-right">{totalHoy > 0 ? (ing/totalHoy*100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CIERRE DE CAJA */}
      {tab === 'cierre' && (
        <div className="card max-w-2xl space-y-4">
          <h3 className="text-sm font-medium text-gray-700">Cierre de caja — {HOY_DISPLAY()}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Ventas',          ventas.length],
              ['Total',           fmt(totalHoy)],
              ['Efectivo',        fmt(efectivo)],
              ['Tarjeta + Transf.', fmt(tarjeta + transferencia)],
            ].map(([l, v]) => (
              <div key={l} className="kpi-card">
                <div className="text-xs text-gray-400 mb-1">{l}</div>
                <div className="text-lg font-semibold">{v}</div>
              </div>
            ))}
          </div>

          <table className="table-base">
            <thead>
              <tr><th>Método</th><th className="text-right">Transacciones</th><th className="text-right">Total</th></tr>
            </thead>
            <tbody>
              {[['efectivo', efectivo], ['tarjeta', tarjeta], ['transferencia', transferencia]].map(([m, t]) => (
                <tr key={m}>
                  <td className="capitalize">{m}</td>
                  <td className="text-right">{ventas.filter(v => v.metodo_pago === m).length}</td>
                  <td className="text-right font-medium">{fmt(t)}</td>
                </tr>
              ))}
              <tr className="font-medium">
                <td>Total</td>
                <td className="text-right">{ventas.length}</td>
                <td className="text-right">{fmt(totalHoy)}</td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Efectivo contado físicamente</label>
              <input type="number" value={cajaFisico} onChange={e => setCajaFisico(e.target.value)} placeholder="0.00" step="0.01" />
            </div>
            <div className="form-group">
              <label className="form-label">Diferencia</label>
              <div className="py-2 px-3 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--color-background-secondary)', color: diferencia === 0 ? '#3B6D11' : diferencia > 0 ? '#A8813E' : '#A32D2D' }}>
                {cajaFisico !== '' ? fmt(diferencia) : '—'}
              </div>
            </div>
          </div>

          {cajaFisico !== '' && (
            diferencia === 0
              ? <div className="alert-ok"><CheckCircle size={15} className="text-green-600" /><span className="text-xs font-medium">Caja cuadrada perfectamente.</span></div>
              : diferencia > 0
                ? <div className="alert-warn"><AlertTriangle size={15} /><span className="text-xs">Sobrante de {fmt(diferencia)} — verificar.</span></div>
                : <div className="alert-bad"><AlertTriangle size={15} className="text-red-600" /><span className="text-xs">Faltante de {fmt(Math.abs(diferencia))} — verificar urgente.</span></div>
          )}

          <button onClick={exportarCierre} className="btn-primary flex items-center gap-2">
            <Download size={14} /> Exportar cierre CSV
          </button>
        </div>
      )}
    </div>
  )
}
