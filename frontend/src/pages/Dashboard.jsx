// pages/Dashboard.jsx — v3.0 con stock del dia
import { useState, useEffect } from 'react'
import { useRecetas } from '../hooks/useRecetas'
import { PRODUCTOS, CATEGORIAS } from '../lib/catalogo'
import { LayoutDashboard, ChefHat, AlertTriangle, Package, ShoppingCart, Factory } from 'lucide-react'
import api from '../lib/api'

const fmtC = v => 'C$ ' + (parseFloat(v) || 0).toFixed(2)

export default function Dashboard() {
  const { recetas } = useRecetas()
  const [resumenVentas, setResumenVentas] = useState(null)
  const [stockHoy, setStockHoy] = useState([])

  const totalRecetas = Object.keys(recetas).length
  const sinReceta = PRODUCTOS.length - totalRecetas

  const recetasConMargen = Object.values(recetas).filter(r => {
    const ct = r.ingredientes?.reduce((s, i) => s + i.cantidad * i.precio, 0) || 0
    const cu = r.piezas > 0 ? ct / r.piezas : 0
    const m = r.pventa > 0 ? ((r.pventa - cu) / r.pventa) * 100 : null
    return m !== null && m < 60
  })

  const catCount = {}
  PRODUCTOS.forEach(p => { catCount[p.cat] = (catCount[p.cat] || 0) + 1 })

  useEffect(() => {
    api.get('/ventas/resumen').then(r => setResumenVentas(r.data)).catch(() => {})
    api.get('/produccion/stock-hoy').then(r => setStockHoy(r.data.stock || [])).catch(() => {})
  }, [])

  return (
    <div className="space-y-4 max-w-4xl">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="kpi-card">
          <div className="text-xs text-gray-400 mb-1">Productos activos</div>
          <div className="text-2xl font-semibold">{PRODUCTOS.length}</div>
          <div className="text-xs text-green-600 mt-1">catalogo Master Baker</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-gray-400 mb-1">Recetas guardadas</div>
          <div className="text-2xl font-semibold">{totalRecetas}</div>
          <div className="text-xs text-gray-400 mt-1">de {PRODUCTOS.length} productos</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-gray-400 mb-1">Sin receta</div>
          <div className="text-2xl font-semibold text-red-600">{sinReceta}</div>
          <div className="text-xs text-red-500 mt-1">pendientes</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-gray-400 mb-1">Alertas de margen</div>
          <div className="text-2xl font-semibold text-amber-600">{recetasConMargen.length}</div>
          <div className="text-xs text-amber-600 mt-1">{recetasConMargen.length > 0 ? 'revisar' : 'sin alertas'}</div>
        </div>
      </div>

      {/* Ventas del dia */}
      {resumenVentas && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="kpi-card">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><ShoppingCart size={11} /> Ventas hoy</div>
            <div className="text-2xl font-semibold">{resumenVentas.total_ventas}</div>
            <div className="text-xs text-gray-400 mt-1">transacciones</div>
          </div>
          <div className="kpi-card">
            <div className="text-xs text-gray-400 mb-1">Ingresos hoy</div>
            <div className="text-2xl font-semibold" style={{ color: '#3B6D11' }}>{fmtC(resumenVentas.ingresos)}</div>
            <div className="text-xs text-gray-400 mt-1">ticket prom: {fmtC(resumenVentas.ticket_promedio)}</div>
          </div>
          <div className="kpi-card">
            <div className="text-xs text-gray-400 mb-1">Efectivo</div>
            <div className="text-2xl font-semibold">{fmtC(resumenVentas.efectivo)}</div>
            <div className="text-xs text-gray-400 mt-1">en caja</div>
          </div>
          <div className="kpi-card">
            <div className="text-xs text-gray-400 mb-1">Transferencia</div>
            <div className="text-2xl font-semibold">{fmtC(parseFloat(resumenVentas.tarjeta) + parseFloat(resumenVentas.transferencia))}</div>
            <div className="text-xs text-gray-400 mt-1">tarjeta + transf.</div>
          </div>
        </div>
      )}

      {recetasConMargen.length > 0 && (
        <div className="alert-warn">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-amber-800">Productos con margen menor a 60%</div>
            <div className="text-xs text-amber-700 mt-1">{recetasConMargen.map(r => r.producto).join(', ')}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Stock del dia */}
        <div className="card">
          <h3 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
            <Factory size={14} /> Stock disponible hoy
          </h3>
          {stockHoy.length === 0 ? (
            <div className="text-xs text-gray-400 py-3 text-center">Sin ordenes de produccion hoy</div>
          ) : (
            <div className="space-y-2">
              {stockHoy.map(s => (
                <div key={s.producto} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 truncate flex-1">{s.producto}</span>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <span className="text-gray-400">{s.producido} prod.</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-400">{s.vendido} vend.</span>
                    <span className={`font-semibold px-1.5 py-0.5 rounded ${s.disponible > 0 ? 'text-green-700 bg-green-50' : 'text-gray-400 bg-gray-50'}`}>
                      {s.disponible} disp.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Productos por categoria */}
        <div className="card">
          <h3 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2"><LayoutDashboard size={14} /> Productos por categoria</h3>
          {Object.entries(catCount).sort((a, b) => b[1] - a[1]).map(([cat, cnt]) => (
            <div key={cat} className="mb-2">
              <div className="flex justify-between text-xs text-gray-600 mb-1"><span>{cat}</span><span>{cnt}</span></div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(cnt / PRODUCTOS.length) * 100}%`, background: '#C29C53' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Estado de recetas */}
        <div className="card">
          <h3 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2"><ChefHat size={14} /> Estado de recetas</h3>
          <div className="space-y-1.5">
            {PRODUCTOS.slice(0, 10).map(p => {
              const r = recetas[p.n]
              return (
                <div key={p.n} className="flex justify-between items-center text-xs">
                  <span className="text-gray-700 truncate flex-1">{p.n}</span>
                  {r ? <span className="badge-ok ml-2 flex-shrink-0">Con receta</span> : <span className="badge-bad ml-2 flex-shrink-0">Sin receta</span>}
                </div>
              )
            })}
            {PRODUCTOS.length > 10 && <div className="text-xs text-gray-400 pt-1">+{PRODUCTOS.length - 10} mas...</div>}
          </div>
        </div>

        {/* Top productos vendidos hoy */}
        {resumenVentas?.top_productos?.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2"><ShoppingCart size={14} /> Mas vendidos hoy</h3>
            <div className="space-y-1.5">
              {resumenVentas.top_productos.map(p => (
                <div key={p.producto} className="flex justify-between items-center text-xs">
                  <span className="text-gray-700 truncate flex-1">{p.producto}</span>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <span className="text-gray-400">{p.piezas} pzas</span>
                    <span className="font-medium" style={{ color: '#3B6D11' }}>{fmtC(p.ingresos)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
