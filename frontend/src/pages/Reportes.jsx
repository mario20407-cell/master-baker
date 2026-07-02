// pages/Reportes.jsx
import { useState, useEffect } from 'react'
import { useRecetas } from '../hooks/useRecetas'
import { useCatalogo } from '../hooks/useCatalogo'
import { getInventario, getVentaResumen, getVentas } from '../lib/api'
import { FileText, Printer, TrendingUp, Package, ShoppingCart } from 'lucide-react'

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

function ReporteVentas({ ventas, resumen }) {
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
  return (
    <div className="reporte-body">
      <Header titulo="Reporte de Ventas del Dia" subtitulo={`${cantidad} transacciones - ${fmt(total)} en ingresos`} />
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
        <div style={{ textAlign: 'center', padding: 32, color: '#999', fontSize: 13 }}>Sin ventas registradas hoy</div>
      )}
      <div className="reporte-footer">
        <div>Reporte del dia - {new Date().toLocaleDateString('es-NI')}</div>
        <div>Generado por Master Baker</div>
      </div>
    </div>
  )
}

export default function Reportes() {
  const { recetas } = useRecetas()
  const { cargando } = useCatalogo()
  const [inventario, setInventario] = useState([])
  const [ventas, setVentas] = useState([])
  const [resumen, setResumen] = useState(null)
  const [tab, setTab] = useState('costeo')

  useEffect(() => {
    getInventario().then(r => setInventario(r.data || [])).catch(() => {})
    const hoy = new Date().toISOString().split('T')[0]
    getVentaResumen(hoy).then(r => setResumen(r.data)).catch(() => {})
    getVentas({ fecha: hoy }).then(r => setVentas(r.data?.ventas || r.data || [])).catch(() => {})
  }, [])

  if (cargando) return <div className="text-gray-400 text-sm p-4">Cargando...</div>

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
            <Printer size={14} /> Imprimir / Guardar PDF
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
        <div className="card p-0 overflow-hidden">
          {tab === 'costeo' && <ReporteCosteo recetas={recetas} />}
          {tab === 'inventario' && <ReporteInventario inventario={inventario} />}
          {tab === 'ventas' && <ReporteVentas ventas={ventas} resumen={resumen} />}
        </div>
      </div>

      <div className="reporte-print" style={{ display: 'none' }}>
        {tab === 'costeo' && <ReporteCosteo recetas={recetas} />}
        {tab === 'inventario' && <ReporteInventario inventario={inventario} />}
        {tab === 'ventas' && <ReporteVentas ventas={ventas} resumen={resumen} />}
      </div>
    </>
  )
}