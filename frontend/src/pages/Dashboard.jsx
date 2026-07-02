// pages/Dashboard.jsx — v2.0 rediseno azul marino
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
  const stockCritico = inventario.filter(i => (i.existencia || 0) < 1).slice(0, 5)
  const catCount = {}
  productos.forEach(p => { catCount[p.categoria] = (catCount[p.categoria] || 0) + 1 })
  const ventasHoy = resumenVentas?.total_ventas || 0
  const ingresosHoy = resumenVentas?.ingresos || 0

  if (cargando) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, color:'#888B8D', fontSize:13, fontWeight:700 }}>
      Cargando dashboard...
    </div>
  )

  return (
    <div style={{ maxWidth:1200 }}>

      {/* FILA 1 — KPIs principales (4 columnas) */}
      <KpiGrid cols={4}>
        <KpiCard label='Productos activos' value={productos.length} sub='catalogo Master Baker' color='navy' />
        <KpiCard label='Recetas guardadas' value={totalRecetas} sub={'de ' + productos.length + ' productos'} color='green' />
        <KpiCard label='Sin receta' value={sinReceta} sub='pendientes' color={sinReceta > 0 ? 'red' : 'green'} />
        <KpiCard label='Alertas de margen' value={alertasMargen.length} sub={alertasMargen.length > 0 ? 'revisar' : 'sin alertas'} color={alertasMargen.length > 0 ? 'amber' : 'green'} />
      </KpiGrid>

      {/* FILA 2 — KPIs operativos (3 columnas) */}
      <KpiGrid cols={3}>
        <KpiCard label='Ventas hoy' value={ventasHoy} sub='transacciones' color='navy' />
        <KpiCard label='Ingresos hoy' value={fmt(ingresosHoy)} sub='ventas del dia' color='blue' />
        <KpiCard label='Stock critico' value={stockCritico.length} sub={stockCritico.length > 0 ? 'reabastecer' : 'stock OK'} color={stockCritico.length > 0 ? 'red' : 'green'} />
      </KpiGrid>

      {/* Alerta de margen */}
      {alertasMargen.length > 0 && (
        <div style={{ background:'#FEF9E7', border:'0.5px solid #D68910', borderRadius:8, padding:'10px 14px', display:'flex', alignItems:'flex-start', gap:10, marginBottom:14 }}>
          <AlertTriangle size={16} style={{ color:'#D68910', flexShrink:0, marginTop:1 }} />
          <div>
            <div style={{ color:'#854F0B', fontSize:12, fontWeight:700 }}>Productos con margen menos de 60%</div>
            <div style={{ color:'#D68910', fontSize:11, marginTop:2 }}>{alertasMargen.map(r => r.producto).join(', ')}</div>
          </div>
        </div>
      )}

      {/* FILA 3 — Rentabilidad + Stock critico */}
      <Grid cols={2} gap={12} style={{ marginBottom:12 }}>
        <Card>
          <CardTitle icon={TrendingUp}>Rentabilidad por producto</CardTitle>
          {topRentables.length === 0
            ? <EmptyState icon={TrendingUp} title='Sin datos de rentabilidad' sub='Agrega recetas con precio de venta' />
            : <>
                {topRentables.map(r => (
                  <MarginBar key={r.producto} label={r.producto} pct={parseFloat(r.margen.toFixed(1))} costo={r.cu.toFixed(2)} />
                ))}
                <div style={{ display:'flex', gap:12, marginTop:10, paddingTop:10, borderTop:'0.5px solid #f0f2f5' }}>
                  <span style={{ fontSize:9, color:'#1A7A4A' }}>Excelente mas de 57%</span>
                  <span style={{ fontSize:9, color:'#D68910' }}>Aceptable 40-56%</span>
                  <span style={{ fontSize:9, color:'#C0392B' }}>Critico menos de 40%</span>
                </div>
              </>
          }
        </Card>
        <Card>
          <CardTitle icon={Package}>Stock critico — Reabastecer</CardTitle>
          {stockCritico.length === 0
            ? <EmptyState icon={Package} title='Stock en buen estado' sub='Todos los insumos tienen existencia' />
            : stockCritico.map(i => (
                <div key={i.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'0.5px solid #f0f2f5' }}>
                  <span style={{ color:'#1B2A4A', fontSize:11, fontWeight:700 }}>{i.nombre}</span>
                  <StatusBadge status='danger'>{i.existencia || 0} {i.unidad}</StatusBadge>
                </div>
              ))
          }
        </Card>
      </Grid>

      {/* FILA 4 — Categorias + Estado recetas + Ultimas ventas */}
      <Grid cols={3} gap={12}>
        <Card>
          <CardTitle icon={LayoutDashboard}>Productos por categoria</CardTitle>
          {Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([cat, cnt]) => (
            <div key={cat} style={{ marginBottom:7 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ color:'#1B2A4A', fontSize:10, fontWeight:700 }}>{cat}</span>
                <span style={{ color:'#888B8D', fontSize:10 }}>{cnt}</span>
              </div>
              <div style={{ height:4, background:'#f0f2f5', borderRadius:2, overflow:'hidden' }}>
                <div style={{ width:`${(cnt/productos.length)*100}%`, height:'100%', background:'#1B2A4A', borderRadius:2 }} />
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <CardTitle icon={ChefHat}>Estado de recetas</CardTitle>
          {productos.slice(0, 8).map(p => {
            const tiene = !!recetas[p.nombre]
            return (
              <div key={p.nombre} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', borderBottom:'0.5px solid #f0f2f5' }}>
                <span style={{ color:'#1B2A4A', fontSize:10, fontWeight:700, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.nombre}</span>
                <StatusBadge status={tiene ? 'success' : 'danger'} style={{ marginLeft:6, flexShrink:0 }}>
                  {tiene ? 'Con receta' : 'Sin receta'}
                </StatusBadge>
              </div>
            )
          })}
          {productos.length > 8 && <div style={{ color:'#888B8D', fontSize:9, marginTop:6 }}>+{productos.length - 8} productos mas</div>}
        </Card>
        <Card>
          <CardTitle icon={ShoppingCart}>Ultimas ventas</CardTitle>
          {ventasHoy === 0
            ? <EmptyState icon={ShoppingCart} title='Sin ventas hoy' sub='Las ventas apareceran aqui' />
            : <div style={{ color:'#1B2A4A', fontSize:13, fontWeight:700 }}>{ventasHoy} ventas — {fmt(ingresosHoy)}</div>
          }
        </Card>
      </Grid>

    </div>
  )
}

