// pages/Dashboard.jsx
import { useRecetas } from '../hooks/useRecetas'
import { useCatalogo } from '../hooks/useCatalogo'
import { LayoutDashboard, ChefHat, Package, AlertTriangle } from 'lucide-react'

export default function Dashboard() {
  const { recetas } = useRecetas()
  const { productos, cargando } = useCatalogo()
  const totalRecetas = Object.keys(recetas).length
  const sinReceta = productos.length - totalRecetas

  const recetasConMargen = Object.values(recetas).filter(r => {
    const ct = r.ingredientes?.reduce((s, i) => s + i.cantidad * i.precio, 0) || 0
    const cu = r.piezas > 0 ? ct / r.piezas : 0
    const m = r.pventa > 0 ? ((r.pventa - cu) / r.pventa) * 100 : null
    return m !== null && m < 60
  })

  const catCount = {}
  productos.forEach(p => { catCount[p.categoria] = (catCount[p.categoria] || 0) + 1 })

  if (cargando) return <div className="text-gray-400 text-sm p-4">Cargando catálogo…</div>

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="kpi-card"><div className="text-xs text-gray-400 mb-1">Productos activos</div><div className="text-2xl font-semibold">{productos.length}</div><div className="text-xs text-green-600 mt-1">catálogo Master Baker</div></div>
        <div className="kpi-card"><div className="text-xs text-gray-400 mb-1">Recetas guardadas</div><div className="text-2xl font-semibold">{totalRecetas}</div><div className="text-xs text-gray-400 mt-1">de {productos.length} productos</div></div>
        <div className="kpi-card"><div className="text-xs text-gray-400 mb-1">Sin receta</div><div className="text-2xl font-semibold text-red-600">{sinReceta}</div><div className="text-xs text-red-500 mt-1">pendientes</div></div>
        <div className="kpi-card"><div className="text-xs text-gray-400 mb-1">Alertas de margen</div><div className="text-2xl font-semibold text-amber-600">{recetasConMargen.length}</div><div className="text-xs text-amber-600 mt-1">{recetasConMargen.length > 0 ? 'revisar' : 'sin alertas'}</div></div>
      </div>

      {recetasConMargen.length > 0 && (
        <div className="alert-warn">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-amber-800">Productos con margen &lt; 60%</div>
            <div className="text-xs text-amber-700 mt-1">{recetasConMargen.map(r => r.producto).join(', ')}</div>
          </div>
        </div>
      )}

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
    </div>
  )
}
