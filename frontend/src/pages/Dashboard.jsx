// pages/Dashboard.jsx
import { useState, useEffect } from 'react'
import { useRecetas } from '../hooks/useRecetas'
import { useCatalogo } from '../hooks/useCatalogo'
import { getInventario, getVentaResumen, getCosteos } from '../lib/api'
import { LayoutDashboard, ChefHat, Package, AlertTriangle, TrendingUp, TrendingDown, DollarSign, ShoppingBag } from 'lucide-react'

function fmt(n) { return 'C$ ' + (parseFloat(n) || 0).toFixed(2) }

export default function Dashboard() {
  const { recetas } = useRecetas()
  const { productos, cargando } = useCatalogo()
  const [inventario, setInventario] = useState([])
  const [resumenVentas, setResumenVentas] = useState(null)
  const [costeos, setCosteos] = useState([])

  useEffect(() => {
    getInventario().then(r => setInventario(r.data || [])).catch(() => {})
    const hoy = new Date().toISOString().split('T')[0]
    getVentaResumen(hoy).then(r => setResumenVentas(r.data)).catch(() => {})
    getCosteos({ limit: 50 }).then(r => setCosteos(r.data?.costeos || r.data || [])).catch(() => {})
  }, [])

  const totalRecetas = Object.keys(recetas).length
  const sinReceta = productos.length - totalRecetas

  // Calcular margen por receta
  const recetasConDatos = Object.values(recetas).map(r => {
    const ct = r.ingredientes?.reduce((s, i) => {
      const cant = i.cantidad || 0
      return s + cant * (i.precio || 0)
    }, 0) || 0
    const cu = r.piezas > 0 ? ct / r.piezas : 0
    const margen = r.pventa > 0 ? ((r.pventa - cu) / r.pventa) * 100 : null
    return { ...r, cu, margen, ct }
  }).filter(r => r.margen !== null)

  const recetasConMargen = recetasConDatos.filter(r => r.margen < 60)
  const topRentables = [...recetasConDatos].sort((a, b) => b.margen - a.margen).slice(0, 5)

  // Stock bajo (menos de 20% de existencia vs promedio)
  const stockBajo = inventario.filter(i => (i.existencia || 0) < 1).slice(0, 5)

  const catCount = {}
  productos.forEach(p => { catCount[p.categoria] = (catCount[p.categoria] || 0) + 1 })

  // Ventas del día
  const ventasHoy = resumenVentas?.total_ventas || 0
  const ingresosHoy = resumenVentas?.total_ingresos || 0

  // Último costeo por producto
  const ultimosCosteos = {}
  ;(Array.isArray(costeos) ? costeos : []).forEach(c => {
    if (!ultimosCosteos[c.producto]) ultimosCosteos[c.producto] = c
  })

  if (cargando) return <div className="text-gray-400 text-sm p-4">Cargando…</div>

  return (
    <div className="space-y-4 max-w-4xl">

      {/* KPIs principales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="kpi-card">
          <div className="text-xs text-gray-400 mb-1">Productos activos</div>
          <div className="text-2xl font-semibold">{productos.length}</div>
          <div className="text-xs text-green-600 mt-1">catálogo Master Baker</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-gray-400 mb-1">Recetas guardadas</div>
          <div className="text-2xl font-semibold">{totalRecetas}</div>
          <div className="text-xs text-gray-400 mt-1">de {productos.length} productos</div>
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

      {/* KPIs de ventas del día */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="kpi-card">
          <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><ShoppingBag size={11} /> Ventas hoy</div>
          <div className="text-2xl font-semibold">{ventasHoy}</div>
          <div className="text-xs text-gray-400 mt-1">transacciones</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><DollarSign size={11} /> Ingresos hoy</div>
          <div className="text-2xl font-semibold text-green-700">{fmt(ingresosHoy)}</div>
          <div className="text-xs text-gray-400 mt-1">ventas del día</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Package size={11} /> Items en stock bajo</div>
          <div className="text-2xl font-semibold text-red-600">{stockBajo.length}</div>
          <div className="text-xs text-red-500 mt-1">{stockBajo.length > 0 ? 'reabastecer' : 'stock OK'}</div>
        </div>
      </div>

      {/* Alerta de margen */}
      {recetasConMargen.length > 0 && (
        <div className="alert-warn">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-amber-800">Productos con margen &lt; 60%</div>
            <div className="text-xs text-amber-700 mt-1">{recetasConMargen.map(r => r.producto).join(', ')}</div>
          </div>
        </div>
      )}

      {/* Rentabilidad por producto */}
      {topRentables.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-medium text-gray-600 mb-4 flex items-center gap-2">
            <TrendingUp size={14} /> Rentabilidad por producto
          </h3>
          <div className="space-y-3">
            {topRentables.map(r => {
              const color = r.margen >= 57 ? '#16a34a' : r.margen >= 40 ? '#d97706' : '#dc2626'
              const bg = r.margen >= 57 ? '#dcfce7' : r.margen >= 40 ? '#fef3c7' : '#fee2e2'
              return (
                <div key={r.producto}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-700 font-medium">{r.producto}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Costo: {fmt(r.cu)}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color, background: bg }}>
                        {r.margen.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(r.margen, 100)}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600 inline-block"></span> Excelente ≥57%</span>
            <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Aceptable 40-56%</span>
            <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> Crítico &lt;40%</span>
          </div>
        </div>
      )}

      {/* Grid inferior */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2"><LayoutDashboard size={14} /> Productos por categoría</h3>
          {Object.entries(catCount).sort((a, b) => b[1] - a[1]).map(([cat, cnt]) => (
            <div key={cat} className="mb-2">
              <div className="flex justify-between text-xs text-gray-600 mb-1"><span>{cat}</span><span>{cnt}</span></div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(cnt / productos.length) * 100}%`, background: '#C29C53' }} />
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2"><ChefHat size={14} /> Estado de recetas</h3>
          <div className="space-y-1.5">
            {productos.slice(0, 10).map(p => {
              const r = recetas[p.nombre]
              return (
                <div key={p.nombre} className="flex justify-between items-center text-xs">
                  <span className="text-gray-700 truncate flex-1">{p.nombre}</span>
                  {r ? <span className="badge-ok ml-2 flex-shrink-0">Con receta</span> : <span className="badge-bad ml-2 flex-shrink-0">Sin receta</span>}
                </div>
              )
            })}
            {productos.length > 10 && <div className="text-xs text-gray-400 pt-1">+{productos.length - 10} más…</div>}
          </div>
        </div>
      </div>

      {/* Stock bajo */}
      {stockBajo.length > 0 && (
        <div className="card border-red-100">
          <h3 className="text-sm font-medium text-red-600 mb-3 flex items-center gap-2">
            <Package size={14} /> Insumos con stock crítico
          </h3>
          <div className="space-y-1.5">
            {stockBajo.map(i => (
              <div key={i.id} className="flex justify-between items-center text-xs">
                <span className="text-gray-700">{i.nombre}</span>
                <span className="text-red-600 font-medium">{i.existencia || 0} {i.unidad}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
