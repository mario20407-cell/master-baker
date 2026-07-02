// pages/Dashboard.jsx — v2.1
import { useState, useEffect } from 'react'
import { useRecetas } from '../hooks/useRecetas'
import { useCatalogo } from '../hooks/useCatalogo'
import { getInventario, getVentaResumen } from '../lib/api'
import api from '../lib/api'
import { TrendingUp, Package, ChefHat, ShoppingCart, AlertTriangle, LayoutDashboard, Target, DollarSign, Edit2, Check, X } from 'lucide-react'
import { Card, CardTitle, KpiCard, KpiGrid, Grid, MarginBar, EmptyState, StatusBadge } from '../components/UI'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const META_KEY  = `marquez_meta_mensual_${TENANT_ID}`

function fmt(n)    { return 'C$ ' + (parseFloat(n) || 0).toFixed(2) }
function fmtN(n)   { return 'C$ ' + (parseFloat(n) || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

function convertir(cantidad, unidad, unidadInv) {
  const u = unidad || ''; const ui = unidadInv || unidad || ''; let q = cantidad || 0
  if (u === 'g' && ui === 'kg') q = q / 1000
  else if (u === 'ml' && (ui === 'L' || ui === 'l')) q = q / 1000
  else if (u === 'libra' && ui === 'kg') q = q * 0.454
  else if (u === 'arroba' && ui === 'kg') q = q * 11.5
  return q
}

// ── Presupuesto del mes ───────────────────────────────────────────────────────
function PresupuestoMes({ ingresosMes }) {
  const [meta, setMeta]         = useState(() => parseFloat(localStorage.getItem(META_KEY)) || null)
  const [editando, setEditando] = useState(false)
  const [input, setInput]       = useState('')

  const guardar = () => {
    const val = parseFloat(input)
    if (!val || val <= 0) return
    localStorage.setItem(META_KEY, val)
    setMeta(val)
    setEditando(false)
  }

  const cancelar = () => { setEditando(false); setInput('') }

  const pct     = meta ? Math.min((ingresosMes / meta) * 100, 100) : 0
  const faltan  = meta ? Math.max(meta - ingresosMes, 0) : 0
  const color   = pct >= 100 ? '#1A7A4A' : pct >= 60 ? '#D68910' : '#C0392B'

  return (
    <Card>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <CardTitle icon={Target}>Presupuesto del mes</CardTitle>
        {meta && !editando && (
          <button onClick={() => { setInput(String(meta)); setEditando(true) }}
            style={{ color:'#888B8D', cursor:'pointer', background:'none', border:'none', padding:2 }}>
            <Edit2 size={13} />
          </button>
        )}
      </div>

      {!meta && !editando ? (
        <div style={{ textAlign:'center', padding:'16px 0' }}>
          <p style={{ color:'#888B8D', fontSize:11, marginBottom:10 }}>No hay meta mensual configurada</p>
          <button onClick={() => setEditando(true)}
            style={{ background:'#1B2A4A', color:'#fff', border:'none', borderRadius:6, padding:'6px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
            Configurar meta
          </button>
        </div>
      ) : editando ? (
        <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:10 }}>
          <span style={{ color:'#888B8D', fontSize:12 }}>C$</span>
          <input
            type="number" min="1" value={input} autoFocus
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') cancelar() }}
            style={{ flex:1, border:'1px solid #ddd', borderRadius:6, padding:'4px 8px', fontSize:13, fontWeight:700 }}
            placeholder="Ej: 50000"
          />
          <button onClick={guardar}  style={{ color:'#1A7A4A', background:'none', border:'none', cursor:'pointer', padding:2 }}><Check size={16} /></button>
          <button onClick={cancelar} style={{ color:'#C0392B', background:'none', border:'none', cursor:'pointer', padding:2 }}><X size={16} /></button>
        </div>
      ) : (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ color:'#1B2A4A', fontSize:12, fontWeight:700 }}>{fmtN(ingresosMes)}</span>
            <span style={{ color:'#888B8D', fontSize:11 }}>meta {fmtN(meta)}</span>
          </div>
          <div style={{ height:8, background:'#f0f2f5', borderRadius:4, overflow:'hidden', marginBottom:8 }}>
            <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:4, transition:'width 0.4s' }} />
          </div>
          <p style={{ fontSize:11, color:'#555' }}>
            Llevas {fmtN(ingresosMes)} de {fmtN(meta)} ({pct.toFixed(1)}%)
            {faltan > 0
              ? <> — faltan <strong>{fmtN(faltan)}</strong> para cumplir la meta</>
              : <> — <strong style={{ color:'#1A7A4A' }}>¡Meta cumplida!</strong></>
            }
          </p>
        </>
      )}
    </Card>
  )
}

// ── Caja del día ──────────────────────────────────────────────────────────────
function CajaDelDia({ ingresosHoy }) {
  const [costoHoy, setCostoHoy] = useState(null)

  useEffect(() => {
    const hoy = new Date().toISOString().split('T')[0]
    api.get('/lotes', { params: { fecha: hoy } })
      .then(({ data }) => {
        const total = (data || []).reduce((s, l) => s + parseFloat(l.costo_total || 0), 0)
        setCostoHoy(total)
      })
      .catch(() => setCostoHoy(0))
  }, [])

  if (costoHoy === null) return (
    <Card><CardTitle icon={DollarSign}>Caja del día</CardTitle>
      <p style={{ color:'#888B8D', fontSize:11 }}>Cargando...</p>
    </Card>
  )

  const sinCosto  = costoHoy === 0
  const utilidad  = ingresosHoy - costoHoy
  const roi       = costoHoy > 0 ? (ingresosHoy / costoHoy) * 100 : null

  return (
    <Card>
      <CardTitle icon={DollarSign}>Caja del día</CardTitle>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 16px', marginBottom:10 }}>
        {[
          { label:'Ingresos',         value: fmtN(ingresosHoy),         color:'#1A7A4A' },
          { label:'Costo producción',  value: sinCosto ? '--' : fmtN(costoHoy), color:'#C0392B' },
          { label:'Utilidad',          value: sinCosto ? '--' : fmtN(utilidad),  color: utilidad >= 0 ? '#1A7A4A' : '#C0392B' },
          { label:'ROI',               value: roi !== null ? roi.toFixed(1) + '%' : '--', color: roi >= 100 ? '#1A7A4A' : '#D68910' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding:'8px 10px', background:'#f8f9fa', borderRadius:6 }}>
            <div style={{ color:'#888B8D', fontSize:9, fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>{label}</div>
            <div style={{ color, fontSize:14, fontWeight:700 }}>{value}</div>
          </div>
        ))}
      </div>

      {sinCosto ? (
        <div style={{ background:'#FEF9E7', border:'0.5px solid #D68910', borderRadius:6, padding:'8px 10px', fontSize:10, color:'#854F0B' }}>
          Registra el costo en <strong>Caja de Producción</strong> para ver la rentabilidad real
        </div>
      ) : (
        <div style={{ fontSize:11, color:'#555', borderTop:'0.5px solid #f0f2f5', paddingTop:8 }}>
          {utilidad >= 0
            ? <>Ganancia neta de <strong style={{ color:'#1A7A4A' }}>{fmtN(utilidad)}</strong> sobre un costo de {fmtN(costoHoy)}</>
            : <>Pérdida de <strong style={{ color:'#C0392B' }}>{fmtN(Math.abs(utilidad))}</strong> — ingresos no cubrieron el costo de producción</>
          }
        </div>
      )}
    </Card>
  )
}

// ── Dashboard principal ───────────────────────────────────────────────────────
export default function Dashboard() {
  const { recetas } = useRecetas()
  const { productos, cargando } = useCatalogo()
  const [inventario, setInventario]     = useState([])
  const [resumenVentas, setResumenVentas] = useState(null)
  const [ingresosMes, setIngresosMes]   = useState(0)

  useEffect(() => {
    const hoy = new Date().toISOString().split('T')[0]
    getInventario().then(r => setInventario(r.data || [])).catch(() => {})
    getVentaResumen(hoy).then(r => setResumenVentas(r.data)).catch(() => {})

    // Ingresos del mes: consultar resumen sin fecha filtra por mes? No — usamos el primer día del mes
    const primerDiaMes = hoy.slice(0, 7) + '-01'
    // Sumar ventas desde el primer día: iteramos días o usamos endpoint cierre
    // Más simple: GET /ventas?desde=... no existe, así que usamos resumen acumulando el mes
    // Por ahora aproximamos con los datos del mes via cierre
    api.get('/ventas', { params: { limit: 500 } })
      .then(({ data }) => {
        const mes = hoy.slice(0, 7)
        const total = (data || [])
          .filter(v => v.fecha && v.fecha.slice(0, 7) === mes)
          .reduce((s, v) => s + parseFloat(v.total || 0), 0)
        setIngresosMes(total)
      })
      .catch(() => {})
  }, [])

  const totalRecetas   = Object.keys(recetas).length
  const sinReceta      = productos.length - totalRecetas
  const recetasConDatos = Object.values(recetas).map(r => {
    const ct = r.ingredientes?.reduce((s, i) => s + convertir(i.cantidad, i.unidad, i.unidad_inventario) * (i.precio || 0), 0) || 0
    const cu = r.piezas > 0 ? ct / r.piezas : 0
    const margen = r.pventa > 0 ? ((r.pventa - cu) / r.pventa) * 100 : null
    return { ...r, cu, margen, ct }
  }).filter(r => r.margen !== null)

  const alertasMargen = recetasConDatos.filter(r => r.margen < 60)
  const topRentables  = [...recetasConDatos].sort((a, b) => b.margen - a.margen).slice(0, 5)
  const stockCritico  = inventario.filter(i => (i.existencia || 0) < 1).slice(0, 5)
  const catCount = {}
  productos.forEach(p => { catCount[p.categoria] = (catCount[p.categoria] || 0) + 1 })
  const ventasHoy   = resumenVentas?.total_ventas || 0
  const ingresosHoy = resumenVentas?.ingresos || 0

  if (cargando) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, color:'#888B8D', fontSize:13, fontWeight:700 }}>
      Cargando dashboard...
    </div>
  )

  return (
    <div style={{ maxWidth:1200 }}>

      {/* FILA 1 — KPIs principales */}
      <KpiGrid cols={4}>
        <KpiCard label='Productos activos'  value={productos.length}      sub='catalogo Master Baker'                         color='navy' />
        <KpiCard label='Recetas guardadas'  value={totalRecetas}          sub={'de ' + productos.length + ' productos'}       color='green' />
        <KpiCard label='Sin receta'         value={sinReceta}             sub='pendientes'                                    color={sinReceta > 0 ? 'red' : 'green'} />
        <KpiCard label='Alertas de margen'  value={alertasMargen.length}  sub={alertasMargen.length > 0 ? 'revisar' : 'sin alertas'} color={alertasMargen.length > 0 ? 'amber' : 'green'} />
      </KpiGrid>

      {/* FILA 2 — KPIs operativos */}
      <KpiGrid cols={3}>
        <KpiCard label='Ventas hoy'    value={ventasHoy}          sub='transacciones'  color='navy' />
        <KpiCard label='Ingresos hoy'  value={fmt(ingresosHoy)}   sub='ventas del dia' color='blue' />
        <KpiCard label='Stock critico' value={stockCritico.length} sub={stockCritico.length > 0 ? 'reabastecer' : 'stock OK'} color={stockCritico.length > 0 ? 'red' : 'green'} />
      </KpiGrid>

      {/* FILA 3 — Presupuesto + Caja del día */}
      <Grid cols={2} gap={12} style={{ marginBottom:12 }}>
        <PresupuestoMes ingresosMes={ingresosMes} />
        <CajaDelDia ingresosHoy={ingresosHoy} />
      </Grid>

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

      {/* FILA 4 — Rentabilidad + Stock critico */}
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

      {/* FILA 5 — Categorias + Estado recetas + Ultimas ventas */}
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
