// pages/Reportes.jsx
import { useState, useEffect } from 'react'
import { useRecetas } from '../hooks/useRecetas'
import { useCatalogo } from '../hooks/useCatalogo'
import { getInventario, getVentaResumen, getVentas, getSucursales } from '../lib/api'
import { FileText, Printer, TrendingUp, Package, ShoppingCart, Search } from 'lucide-react'

function fmt(n) { return 'C$ ' + (parseFloat(n) || 0).toFixed(2) }

function convertir(cantidad, unidad, unidadInv) {
  const u = unidad || ''
  const ui = unidadInv || unidad || ''
  let q = cantidad || 0
  if (u === 'g' && ui === 'kg') q = q / 1000
  else if (u === 'ml' && (ui === 'L' || ui === 'l')) q = q / 1000
  else if (u === 'libra' && ui === 'kg') q = q * 0.454
  else if (u === 'arroba' && ui === 'kg') q = q * 11.5
  return q
}

function Header({ titulo, subtitulo }) {
  const hoy = new Date().toLocaleDateString('es-NI', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return (
    <div className="reporte-header">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>🍞 Master Baker</div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>Repostería Márquez</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: '#666' }}>
          <div style={{ fontWeight: 600, color: '#1a1a1a', fontSize: 16 }}>{titulo}</div>
          <div>{hoy}</div>
          {subtitulo && <div style={{ color: '#C29C53', marginTop: 2 }}>{subtitulo}</div>}
        </div>
      </div>
      <div style={{ height: 2, background: 'linear-gradient(to right, #C29C53, #e8d5a3)', marginTop: 12 }} />
    </div>
  )
}

function ReporteCosteo({ recetas }) {
  const datos = Object.values(recetas).map(r => {
    const ct = r.ingredientes?.reduce((s, i) => s + convertir(i.cantidad, i.unidad, i.unidad_inventario) * (i.precio || 0), 0) || 0
    const cu = r.piezas > 0 ? ct / r.piezas : 0
    const margen = r.pventa > 0 ? ((r.pventa - cu) / r.pventa) * 100 : null
    const utilidad = r.pventa > 0 && r.piezas > 0 ? (r.pventa - cu) * r.piezas : 0
    return { producto: r.producto, piezas: r.piezas, pventa: r.pventa, ct, cu, margen, utilidad }
  }).filter(r => r.margen !== null).sort((a, b) => b.margen - a.margen)

  const totalUtilidad = datos.reduce((s, r) => s + r.utilidad, 0)

  return (
    <div className="reporte-body">
      <Header titulo="Reporte de Rentabilidad" subtitulo={`${datos.length} productos con receta`} />
      <table className="reporte-tabla">
        <thead>
          <tr>
            <th>Producto</th>
            <th style={{ textAlign: 'center' }}>Piezas</th>
            <th style={{ textAlign: 'right' }}>Costo unit.</th>
            <th style={{ textAlign: 'right' }}>P. Venta</th>
            <th style={{ textAlign: 'right' }}>Costo lote</th>
            <th style={{ textAlign: 'right' }}>Utilidad lote</th>
            <th style={{ textAlign: 'center' }}>Margen</th>
          </tr>
        </thead>
        <tbody>
          {datos.map(r => (
            <tr key={r.producto}>
              <td style={{ fontWeight: 500 }}>{r.producto}</td>
              <td style={{ textAlign: 'center' }}>{r.piezas}</td>
              <td style={{ textAlign: 'right' }}>{fmt(r.cu)}</td>
              <td style={{ textAlign: 'right' }}>{fmt(r.pventa)}</td>
              <td style={{ textAlign: 'right' }}>{fmt(r.ct)}</td>
              <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{fmt(r.utilidad)}</td>
              <td style={{ textAlign: 'center' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: r.margen >= 57 ? '#dcfce7' : r.margen >= 40 ? '#fef3c7' : '#fee2e2',
                  color: r.margen >= 57 ? '#16a34a' : r.margen >= 40 ? '#d97706' : '#dc2626'
                }}>{r.margen.toFixed(1)}%</span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} style={{ fontWeight: 700, textAlign: 'right' }}>Utilidad total estimada por hornada:</td>
            <td style={{ fontWeight: 700, textAlign: 'right', color: '#16a34a' }}>{fmt(totalUtilidad)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div className="reporte-footer">
        <div style={{ display: 'flex', gap: 24 }}>
          <span>🟢 Excelente 57%</span>
          <span>🟡 Aceptable 40-56%</span>
          <span>🔴 Critico 40%</span>
        </div>
        <div>Generado por Master Baker</div>
      </div>
    </div>
  )
}

function ReporteInventario({ inventario }) {
  const criticos = inventario.filter(i => (i.existencia || 0) < 1)
  const normales = inventario.filter(i => (i.existencia || 0) >= 1)
  return (
    <div className="reporte-body">
      <Header titulo="Reporte de Inventario" subtitulo={`${inventario.length} insumos - ${criticos.length} en stock critico`} />
      {criticos.length > 0 && (
        <>
          <div style={{ fontWeight: 700, color: '#dc2626', margin: '16px 0 8px', fontSize: 13 }}>Insumos con stock critico</div>
          <table className="reporte-tabla">
            <thead><tr><th>Insumo</th><th style={{ textAlign: 'right' }}>Existencia</th><th>Unidad</th><th style={{ textAlign: 'right' }}>Costo unit.</th></tr></thead>
            <tbody>
              {criticos.map(i => (
                <tr key={i.id} style={{ background: '#fff5f5' }}>
                  <td style={{ fontWeight: 500 }}>{i.nombre}</td>
                  <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{i.existencia || 0}</td>
                  <td>{i.unidad}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(i.costo_unitario)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <div style={{ fontWeight: 700, color: '#16a34a', margin: '16px 0 8px', fontSize: 13 }}>Insumos con stock disponible</div>
      <table className="reporte-tabla">
        <thead><tr><th>Insumo</th><th style={{ textAlign: 'right' }}>Existencia</th><th>Unidad</th><th style={{ textAlign: 'right' }}>Costo unit.</th><th>Categoria</th></tr></thead>
        <tbody>
          {normales.map(i => (
            <tr key={i.id}>
              <td>{i.nombre}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{i.existencia || 0}</td>
              <td>{i.unidad}</td>
              <td style={{ textAlign: 'right' }}>{fmt(i.costo_unitario)}</td>
              <td style={{ color: '#666', fontSize: 11 }}>{i.categoria || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="reporte-footer">
        <div>Total: {inventario.length} | En stock: {normales.length} | Criticos: {criticos.length}</div>
        <div>Generado por Master Baker</div>
      </div>
    </div>
  )
}

function ReporteVentas({ ventas, resumen, filtros }) {
  const total = resumen?.ingresos || 0
  const cantidad = resumen?.total_ventas || 0
  const porProducto = {}
  ;(ventas || []).forEach(v => {
    (v.items || []).forEach(item => {
      const k = item.producto || 'Otro'
      if (!porProducto[k]) porProducto[k] = { producto: k, cantidad: 0, total: 0 }
      porProducto[k].cantidad += item.cantidad || 1
      porProducto[k].total += (item.precio_unit || 0) * (item.cantidad || 1)
    })
  })
  const ranking = Object.values(porProducto).sort((a, b) => b.total - a.total)

  const porMetodo = [
    { label: 'Efectivo',      valor: resumen?.efectivo || 0,      color: '#16a34a' },
    { label: 'Tarjeta',       valor: resumen?.tarjeta || 0,       color: '#1d4ed8' },
    { label: 'Transferencia', valor: resumen?.transferencia || 0, color: '#7c3aed' },
  ]
  const porSucursal = resumen?.por_sucursal || []

  const rangoLabel = filtros?.desde === filtros?.hasta
    ? filtros?.desde
    : `${filtros?.desde} a ${filtros?.hasta}`
  const subFiltros = [
    rangoLabel,
    filtros?.sucursalNombre && filtros.sucursalNombre !== 'Todas' ? filtros.sucursalNombre : null,
    filtros?.metodoPago && filtros.metodoPago !== 'todos' ? filtros.metodoPago : null,
    filtros?.producto ? `"${filtros.producto}"` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="reporte-body">
      <Header titulo="Reporte de Ventas" subtitulo={subFiltros} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, margin: '16px 0' }}>
        <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#666' }}>Total ingresos</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{fmt(total)}</div>
        </div>
        <div style={{ background: '#eff6ff', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#666' }}>Transacciones</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1d4ed8' }}>{cantidad}</div>
        </div>
        <div style={{ background: '#fefce8', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#666' }}>Ticket promedio</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>{fmt(cantidad > 0 ? total / cantidad : 0)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, margin: '16px 0' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, margin: '0 0 8px' }}>Resumen por método de pago</div>
          <table className="reporte-tabla">
            <tbody>
              {porMetodo.map(m => (
                <tr key={m.label}>
                  <td style={{ fontWeight: 500 }}>{m.label}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: m.color }}>{fmt(m.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, margin: '0 0 8px' }}>Resumen por sucursal</div>
          {porSucursal.length > 0 ? (
            <table className="reporte-tabla">
              <tbody>
                {porSucursal.map(s => (
                  <tr key={s.sucursal}>
                    <td style={{ fontWeight: 500 }}>{s.sucursal}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#999', fontSize: 12 }}>Sin datos de sucursal</div>
          )}
        </div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, margin: '16px 0 8px' }}>Ranking de productos</div>
      {ranking.length > 0 ? (
        <table className="reporte-tabla">
          <thead><tr><th>#</th><th>Producto</th><th style={{ textAlign: 'center' }}>Unidades</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
          <tbody>
            {ranking.map((r, i) => (
              <tr key={r.producto}>
                <td style={{ color: '#666', fontSize: 11 }}>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{r.producto}</td>
                <td style={{ textAlign: 'center' }}>{r.cantidad}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ textAlign: 'center', padding: 16, color: '#999', fontSize: 13 }}>Sin ventas en el rango seleccionado</div>
      )}

      <div style={{ fontWeight: 700, fontSize: 13, margin: '16px 0 8px' }}>Transacciones ({(ventas || []).length})</div>
      {(ventas || []).length > 0 ? (
        <table className="reporte-tabla">
          <thead>
            <tr>
              <th>#</th><th>Hora</th><th>Cliente</th><th>Sucursal</th>
              <th>Método de pago</th><th>Canal</th><th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v, i) => (
              <tr key={v.id}>
                <td style={{ color: '#666', fontSize: 11 }}>{i + 1}</td>
                <td>{v.hora?.slice(0, 5)}</td>
                <td style={{ fontWeight: 500 }}>{(!v.cliente || v.cliente === 'Sin nombre') ? 'Cliente general' : v.cliente}</td>
                <td>{v.sucursal_nombre || 'Sin sucursal'}</td>
                <td style={{ textTransform: 'capitalize' }}>{v.metodo_pago}</td>
                <td style={{ textTransform: 'capitalize' }}>{v.canal}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(v.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ textAlign: 'center', padding: 32, color: '#999', fontSize: 13 }}>Sin ventas registradas en el rango seleccionado</div>
      )}

      <div className="reporte-footer">
        <div>Reporte generado el {new Date().toLocaleDateString('es-NI')}</div>
        <div>Generado por Master Baker</div>
      </div>
    </div>
  )
}

const METODOS = [
  { id: 'todos', label: 'Todos' },
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'transferencia', label: 'Transferencia' },
]

export default function Reportes() {
  const { recetas } = useRecetas()
  const { cargando } = useCatalogo()
  const [inventario, setInventario] = useState([])
  const [ventas, setVentas] = useState([])
  const [resumen, setResumen] = useState(null)
  const [sucursales, setSucursales] = useState([])
  const [tab, setTab] = useState('costeo')

  const hoy = new Date().toISOString().split('T')[0]
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(hoy)
  const [sucursalId, setSucursalId] = useState('')
  const [metodoPago, setMetodoPago] = useState('todos')
  const [producto, setProducto] = useState('')
  const [productoInput, setProductoInput] = useState('')

  useEffect(() => {
    getInventario().then(r => setInventario(r.data || [])).catch(() => {})
    getSucursales().then(r => setSucursales(r.data || [])).catch(() => {})
  }, [])

  // Búsqueda de producto con debounce — evita una request por cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setProducto(productoInput.trim()), 400)
    return () => clearTimeout(t)
  }, [productoInput])

  useEffect(() => {
    if (tab !== 'ventas') return
    const params = {
      desde, hasta,
      sucursal_id: sucursalId || undefined,
      metodo_pago: metodoPago !== 'todos' ? metodoPago : undefined,
      producto: producto || undefined,
    }
    getVentaResumen(params).then(r => setResumen(r.data)).catch(() => {})
    getVentas({ ...params, limit: 500 }).then(r => setVentas(r.data || [])).catch(() => {})
  }, [tab, desde, hasta, sucursalId, metodoPago, producto])

  if (cargando) return <div className="text-gray-400 text-sm p-4">Cargando...</div>

  const sucursalNombre = sucursales.find(s => s.id === sucursalId)?.nombre || 'Todas'
  const filtros = { desde, hasta, sucursalNombre, metodoPago, producto }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .reporte-print, .reporte-print * { visibility: visible !important; }
          .reporte-print { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
        .reporte-header { margin-bottom: 16px; }
        .reporte-body { font-family: sans-serif; font-size: 13px; color: #1a1a1a; padding: 8px; }
        .reporte-tabla { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 12px; }
        .reporte-tabla th { background: #f8f5f0; padding: 6px 10px; text-align: left; font-size: 11px; color: #666; border-bottom: 2px solid #e5e7eb; }
        .reporte-tabla td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; }
        .reporte-tabla tfoot td { border-top: 2px solid #e5e7eb; background: #f8f5f0; padding: 8px 10px; }
        .reporte-footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #999; }
      `}</style>

      <div className="max-w-4xl no-print">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FileText size={18} /> Reportes
          </h2>
          <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
            <Printer size={14} /> {tab === 'ventas' ? 'Exportar PDF' : 'Imprimir / Guardar PDF'}
          </button>
        </div>
        <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
          {[['costeo', TrendingUp, 'Rentabilidad'], ['inventario', Package, 'Inventario'], ['ventas', ShoppingCart, 'Ventas']].map(([id, Icon, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-1.5 text-sm rounded-lg transition-all flex items-center gap-1.5 ${tab === id ? 'bg-white font-medium shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {tab === 'ventas' && (
          <div className="card mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="form-group">
                <label className="form-label">Desde</label>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} max={hasta} />
              </div>
              <div className="form-group">
                <label className="form-label">Hasta</label>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} min={desde} />
              </div>
              <div className="form-group">
                <label className="form-label">Sucursal</label>
                <select value={sucursalId} onChange={e => setSucursalId(e.target.value)}>
                  <option value="">Todas</option>
                  {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Producto</label>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="pl-7" value={productoInput} onChange={e => setProductoInput(e.target.value)} placeholder="Buscar..." />
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {METODOS.map(m => (
                <button key={m.id} onClick={() => setMetodoPago(m.id)}
                  className={`px-3 py-1 text-xs rounded-lg border transition-all ${metodoPago === m.id
                    ? 'border-brand-400 text-white font-medium'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  style={metodoPago === m.id ? { background: '#C29C53' } : {}}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="card p-0 overflow-hidden">
          {tab === 'costeo' && <ReporteCosteo recetas={recetas} />}
          {tab === 'inventario' && <ReporteInventario inventario={inventario} />}
          {tab === 'ventas' && <ReporteVentas ventas={ventas} resumen={resumen} filtros={filtros} />}
        </div>
      </div>

      <div className="reporte-print" style={{ display: 'none' }}>
        {tab === 'costeo' && <ReporteCosteo recetas={recetas} />}
        {tab === 'inventario' && <ReporteInventario inventario={inventario} />}
        {tab === 'ventas' && <ReporteVentas ventas={ventas} resumen={resumen} filtros={filtros} />}
      </div>
    </>
  )
}