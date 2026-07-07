// pages/Dashboard.jsx — v2.0 rediseño con modo oscuro y componentes UI
import { useState, useEffect } from 'react'
import { useRecetas } from '../hooks/useRecetas'
import { useCatalogo } from '../hooks/useCatalogo'
import { getInventario, getVentaResumen } from '../lib/api'
import { TrendingUp, Package, ChefHat, ShoppingCart, AlertTriangle, LayoutDashboard } from 'lucide-react'
import { Card, CardTitle, KpiCard, KpiGrid, Grid, MarginBar, EmptyState, StatusBadge } from '../components/UI'

function fmt(n) { return 'C$ ' + (parseFloat(n) || 0).toFixed(2) }

function convertir(cantidad, unidad, unidadInv) {
  const u = unidad || ''; const ui = unidadInv || unidad || ''; let q = cantidad || 0
  if (u === 'g' && ui === 'kg') q = q / 1000
  else if (u === 'ml' && (ui === 'L' || ui === 'l')) q = q / 1000
  else if (u === 'libra' && ui === 'kg') q = q * 0.454
  else if (u === 'arroba' && ui === 'kg') q = q * 11.5
  return q
}

export default function Dashboard() {
  const { recetas } = useRecetas()
  const { productos, cargando } = useCatalogo()
  const [inventario, setInventario] = useState([])
  const [resumenVentas, setResumenVentas] = useState(null)

  useEffect(() => {
    getInventario().then(r => setInventario(r.data || [])).catch(() => {})
    const hoy = new Date().toISOString().split('T')[0]
    getVentaResumen(hoy).then(r => setResumenVentas(r.data)).catch(() => {})
  }, [])

  const totalRecetas = Object.keys(recetas).length
  const sinReceta = productos.length - totalRecetas
  const recetasConDatos = Object.values(recetas).map(r => {
    const ct = r.ingredientes?.reduce((s, i) => s + convertir(i.cantidad, i.unidad, i.unidad_inventario) * (i.precio || 0), 0) || 0
    const cu = r.piezas > 0 ? ct / r.piezas : 0
    const margen = r.pventa > 0 ? ((r.pventa - cu) / r.pventa) * 100 : null
    return { ...r, cu, margen, ct }
  }).filter(r => r.margen !== null)

  const alertasMargen = recetasConDatos.filter(r => r.margen < 60)
  const topRentables = [...recetasConDatos].sort((a, b) => b.margen - a.margen).slice(0, 5)
  const stockCritico = inventario.filter(i => (i.existencia || 0) <= (i.punto_reposicion || 0) || i.estado === 'critico').slice(0, 5)
  const catCount = {}
  productos.forEach(p => { catCount[p.categoria] = (catCount[p.categoria] || 0) + 1 })
  const ventasHoy = resumenVentas?.total_ventas || 0
  const ingresosHoy = resumenVentas?.ingresos || 0

  if (cargando) return (
    <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400 text-sm font-bold">
      Cargando dashboard...
    </div>
  )

  return (
    <div className="space-y-4 max-w-6xl">

      {/* FILA 1 — KPIs principales (4 columnas) */}
      <KpiGrid cols={4}>
        <KpiCard label='Productos activos' value={productos.length} sub='catálogo Master Baker' color='navy' />
        <KpiCard label='Recetas guardadas' value={totalRecetas} sub={'de ' + productos.length + ' productos'} color='green' />
        <KpiCard label='Sin receta' value={sinReceta} sub='pendientes' color={sinReceta > 0 ? 'red' : 'green'} />
        <KpiCard label='Alertas de margen' value={alertasMargen.length} sub={alertasMargen.length > 0 ? 'revisar' : 'sin alertas'} color={alertasMargen.length > 0 ? 'amber' : 'green'} />
      </KpiGrid>

      {/* FILA 2 — KPIs operativos (3 columnas) */}
      <KpiGrid cols={3}>
        <KpiCard label='Ventas hoy' value={ventasHoy} sub='transacciones' color='navy' />
        <KpiCard label='Ingresos hoy' value={fmt(ingresosHoy)} sub='ventas del día' color='blue' />
        <KpiCard label='Stock crítico' value={stockCritico.length} sub={stockCritico.length > 0 ? 'reabastecer' : 'stock OK'} color={stockCritico.length > 0 ? 'red' : 'green'} />
      </KpiGrid>

      {/* Alerta de margen */}
      {alertasMargen.length > 0 && (
        <div className="flex gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-850/50 text-sm">
          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-900 dark:text-amber-300">Productos con margen menos de 60%</div>
            <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">{alertasMargen.map(r => r.producto).join(', ')}</div>
          </div>
        </div>
      )}

      {/* FILA 3 — Rentabilidad + Stock crítico */}
      <Grid cols={2} gap={4}>
        <Card>
          <CardTitle icon={TrendingUp}>Rentabilidad por producto</CardTitle>
          {topRentables.length === 0
            ? <EmptyState icon={TrendingUp} title='Sin datos de rentabilidad' sub='Agrega recetas con precio de venta' />
            : <>
                {topRentables.map(r => (
                  <MarginBar key={r.producto} label={r.producto} pct={parseFloat(r.margen.toFixed(1))} costo={r.cu.toFixed(2)} />
                ))}
                <div className="flex gap-4 mt-4 pt-3 border-t border-gray-100 dark:border-navy-800 text-[10px] font-medium">
                  <span className="text-green-600 dark:text-green-400">Excelente más de 57%</span>
                  <span className="text-amber-600 dark:text-amber-400">Aceptable 40-56%</span>
                  <span className="text-red-600 dark:text-red-400">Crítico menos de 40%</span>
                </div>
              </>
          }
        </Card>
        <Card>
          <CardTitle icon={Package}>Stock crítico — Reabastecer</CardTitle>
          {stockCritico.length === 0
            ? <EmptyState icon={Package} title='Stock en buen estado' sub='Todos los insumos tienen existencia' />
            : <div className="divide-y divide-gray-150 dark:divide-navy-800/80">
                {stockCritico.map(i => (
                  <div key={i.id} className="flex justify-between items-center py-2">
                    <span className="text-xs font-semibold text-[#1B2A4A] dark:text-white">{i.nombre}</span>
                    <StatusBadge status='danger'>{i.existencia || 0} {i.unidad}</StatusBadge>
                  </div>
                ))}
              </div>
          }
        </Card>
      </Grid>

      {/* FILA 4 — Categorías + Estado recetas + Últimas ventas */}
      <Grid cols={3} gap={4}>
        <Card>
          <CardTitle icon={LayoutDashboard}>Productos por categoría</CardTitle>
          {Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([cat, cnt]) => (
            <div key={cat} className="mb-2.5">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-semibold text-[#1B2A4A] dark:text-white">{cat}</span>
                <span className="text-gray-400 dark:text-gray-500">{cnt}</span>
              </div>
              <div className="h-1 bg-gray-150 dark:bg-navy-800 rounded-full overflow-hidden">
                <div className="h-full bg-brand-400 rounded-full" style={{ width: `${(cnt / productos.length) * 100}%` }} />
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <CardTitle icon={ChefHat}>Estado de recetas</CardTitle>
          <div className="divide-y divide-gray-150 dark:divide-navy-800/80">
            {productos.slice(0, 8).map(p => {
              const tiene = !!recetas[p.nombre]
              return (
                <div key={p.nombre} className="flex justify-between items-center py-1.5">
                  <span className="text-xs font-semibold text-[#1B2A4A] dark:text-white truncate max-w-[120px]">{p.nombre}</span>
                  <StatusBadge status={tiene ? 'success' : 'danger'}>
                    {tiene ? 'Con receta' : 'Sin receta'}
                  </StatusBadge>
                </div>
              )
            })}
          </div>
          {productos.length > 8 && (
            <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
              +{productos.length - 8} productos más
            </div>
          )}
        </Card>
        <Card>
          <CardTitle icon={ShoppingCart}>Últimas ventas</CardTitle>
          {ventasHoy === 0
            ? <EmptyState icon={ShoppingCart} title='Sin ventas hoy' sub='Las ventas aparecerán aquí' />
            : <div className="text-sm font-bold text-[#1B2A4A] dark:text-gray-200">
                {ventasHoy} ventas — {fmt(ingresosHoy)}
              </div>
          }
        </Card>
      </Grid>

    </div>
  )
}
