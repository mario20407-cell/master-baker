// pages/Dashboard.jsx — v2.0 rediseño con modo oscuro y componentes UI
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecetas } from '../hooks/useRecetas'
import { useCatalogo } from '../hooks/useCatalogo'
import { useFiscalConfig } from '../hooks/useFiscalConfig'
import { useConfiguracionCosteo } from '../hooks/useConfiguracionCosteo'
import { useAuth } from '../context/AuthContext'
import { useWhatsappNotifications } from '../hooks/useWhatsappNotifications'
import { usePlanilla } from '../hooks/usePlanilla'
import { getInventario, getVentaResumen } from '../lib/api'
import { calcularCosteoReceta } from '../lib/costeo'
import {
  TrendingUp, Package, ChefHat, ShoppingCart, AlertTriangle, LayoutDashboard,
  ListChecks, MessageCircle, ArrowRight,
} from 'lucide-react'
import { Card, CardTitle, KpiCard, KpiGrid, Grid, MarginBar, EmptyState, StatusBadge } from '../components/UI'

const WHATSAPP_GREEN = '#25D366'

function fmt(n) { return 'C$ ' + (parseFloat(n) || 0).toFixed(2) }

function formatoCordobas(n) {
  return 'C$' + (Number(n) || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Formato relativo simple para timestamps recientes — solo presentación,
// no hay ninguna librería de fechas en el proyecto para esto.
function tiempoRelativo(fecha) {
  const diffMin = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000)
  if (diffMin < 1) return 'ahora'
  if (diffMin < 60) return `hace ${diffMin} min`
  const horas = Math.floor(diffMin / 60)
  if (horas < 24) return `hace ${horas} h`
  return `hace ${Math.floor(horas / 24)} d`
}

function AccionesRapidas() {
  const navigate = useNavigate()
  return (
    <Card>
      <CardTitle>Acciones rápidas</CardTitle>
      <div className="space-y-2">
        <button
          onClick={() => navigate('/ventas')}
          className="w-full flex items-center gap-2.5 px-4 py-3.5 rounded-lg bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <ShoppingCart size={18} /> Registrar venta
        </button>
        <button
          onClick={() => navigate('/produccion')}
          className="w-full flex items-center gap-2.5 px-4 py-3.5 rounded-lg bg-surface-muted text-text-default font-medium text-sm hover:bg-border-default transition-colors"
        >
          <TrendingUp size={18} /> Nueva producción
        </button>
        <button
          onClick={() => navigate('/inventario')}
          className="w-full flex items-center gap-2.5 px-4 py-3.5 rounded-lg bg-surface-muted text-text-default font-medium text-sm hover:bg-border-default transition-colors"
        >
          <Package size={18} /> Actualizar inventario
        </button>
      </div>
    </Card>
  )
}

function PanelWhatsapp({ activo }) {
  const navigate = useNavigate()
  const { unreadCount, ultimosNuevos } = useWhatsappNotifications(activo)

  if (!activo) return null

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 border-b border-border-default pb-2">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-brand-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-text-default uppercase tracking-wider">Mensajes de WhatsApp</span>
        </div>
        {unreadCount > 0 && (
          <span
            className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: WHATSAPP_GREEN }}
          >
            {unreadCount} nuevo{unreadCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {ultimosNuevos.length === 0 ? (
        <p className="text-xs text-text-muted py-2">Sin pedidos nuevos por ahora.</p>
      ) : (
        <div className="space-y-3 mb-3">
          {ultimosNuevos.slice(0, 3).map(p => (
            <div key={p.id} className="flex items-start gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: WHATSAPP_GREEN }}
              >
                {(p.nombre || p.telefono || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-text-default truncate">{p.nombre || p.telefono}</span>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: WHATSAPP_GREEN }} />
                </div>
                <p className="text-[11px] text-text-muted truncate">
                  {(p.items?.length || 0)} producto{(p.items?.length || 0) !== 1 ? 's' : ''} — {formatoCordobas(p.total)}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">{tiempoRelativo(p.creado_en)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => navigate('/whatsapp-crm')}
        className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
      >
        Ver todos los mensajes <ArrowRight size={12} />
      </button>
    </Card>
  )
}

function PendientesDelDia({ sinReceta, ventasHoy, activo }) {
  const { historial, cargarHistorial } = usePlanilla()
  const [historialCargado, setHistorialCargado] = useState(false)

  useEffect(() => {
    if (!activo) return
    cargarHistorial().finally(() => setHistorialCargado(true))
  }, [activo, cargarHistorial])

  // Heurística simple: si el fin del último período de planilla generado ya
  // pasó, hay un período nuevo pendiente de generar. Mismos datos que usa
  // Equipo.jsx (historial de planillas), sin recalcular reglas de nómina.
  const hoy = new Date().toISOString().split('T')[0]
  const planillaPendiente = activo && historialCargado &&
    (historial.length === 0 || historial[0].periodo_fin < hoy)

  const pendientes = [
    sinReceta > 0 && {
      color: 'bg-status-danger',
      texto: `${sinReceta} producto${sinReceta !== 1 ? 's' : ''} sin receta`,
    },
    planillaPendiente && {
      color: 'bg-status-warning',
      texto: 'Planilla del período sin generar',
    },
    ventasHoy === 0 && {
      color: 'bg-status-info',
      texto: 'Sin ventas registradas hoy',
    },
  ].filter(Boolean)

  return (
    <Card>
      <CardTitle icon={ListChecks}>Pendientes del día</CardTitle>
      {pendientes.length === 0 ? (
        <p className="text-xs text-text-muted py-2">Todo al día — sin pendientes.</p>
      ) : (
        <ul className="space-y-2.5">
          {pendientes.map((p, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.color}`} />
              <span className="text-xs text-text-subtle">{p.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default function Dashboard() {
  const { usuario } = useAuth()
  const { recetas } = useRecetas()
  const { productos, cargando } = useCatalogo()
  const { config: configFiscal } = useFiscalConfig()
  const { costoIndirectoGlobal, margenObjetivo } = useConfiguracionCosteo()
  const [inventario, setInventario] = useState([])
  const [resumenVentas, setResumenVentas] = useState(null)

  // Mismo gating que el ítem de navegación "WhatsApp" y "Mi Equipo" en
  // Layout.jsx (role: 'admin') — el panel derecho reusa esos mismos datos,
  // así que respeta el mismo control de acceso.
  const esAdmin = usuario?.rol === 'admin'

  useEffect(() => {
    getInventario().then(r => setInventario(r.data || [])).catch(() => {})
    const hoy = new Date().toISOString().split('T')[0]
    getVentaResumen(hoy).then(r => setResumenVentas(r.data)).catch(() => {})
  }, [])

  const totalRecetas = Object.keys(recetas).length
  const sinReceta = productos.length - totalRecetas
  // Usa el mismo motor que Recetas.jsx y Costeo.jsx (lib/costeo.js) en vez
  // de un cálculo propio — antes este dashboard tenía su propia versión
  // simplificada que no aplicaba merma ni los costos indirectos (gas/luz/
  // mano de obra) ni el prorrateo fiscal, así que el margen que mostraba
  // no coincidía con el resto de la app para la misma receta.
  const recetasConDatos = Object.values(recetas)
    .filter(r => (parseFloat(r.pventa) || 0) > 0)
    .map(r => {
      const c = calcularCosteoReceta(r, null, configFiscal, costoIndirectoGlobal, margenObjetivo)
      return { ...r, cu: c.costoUnitario, margen: c.margen, ct: c.costoTotal }
    })

  const alertasMargen = recetasConDatos.filter(r => r.margen < 60)
  const topRentables = [...recetasConDatos].sort((a, b) => b.margen - a.margen).slice(0, 5)
  const stockCritico = inventario.filter(i => (i.existencia || 0) < 1).slice(0, 5)
  const catCount = {}
  productos.forEach(p => { catCount[p.categoria] = (catCount[p.categoria] || 0) + 1 })
  const ventasHoy = resumenVentas?.total_ventas || 0
  const ingresosHoy = resumenVentas?.total_ingresos || 0

  if (cargando) return (
    <div className="flex items-center justify-center h-48 text-text-muted text-sm font-bold">
      Cargando dashboard...
    </div>
  )

  return (
    <div className="grid grid-cols-[1fr_280px] gap-3">
    <div className="space-y-4 min-w-0">

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
        <div className="flex gap-3 p-3 rounded-lg bg-warn-light border border-amber-200 dark:bg-warn/10 dark:border-amber-800/50 text-sm">
          <AlertTriangle size={18} className="text-status-warning flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-status-warning-fg">Productos con margen menos de 60%</div>
            <div className="text-xs text-status-warning-fg mt-1">{alertasMargen.map(r => r.producto).join(', ')}</div>
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
                <div className="flex gap-4 mt-4 pt-3 border-t border-border-default text-[10px] font-medium">
                  <span className="text-status-success">Excelente más de 57%</span>
                  <span className="text-status-warning">Aceptable 40-56%</span>
                  <span className="text-status-danger">Crítico menos de 40%</span>
                </div>
              </>
          }
        </Card>
        <Card>
          <CardTitle icon={Package}>Stock crítico — Reabastecer</CardTitle>
          {stockCritico.length === 0
            ? <EmptyState icon={Package} title='Stock en buen estado' sub='Todos los insumos tienen existencia' />
            : <div className="divide-y divide-border-default">
                {stockCritico.map(i => (
                  <div key={i.id} className="flex justify-between items-center py-2">
                    <span className="text-xs font-semibold text-text-default">{i.nombre}</span>
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
                <span className="font-semibold text-text-default">{cat}</span>
                <span className="text-text-muted">{cnt}</span>
              </div>
              <div className="h-1 bg-border-default rounded-full overflow-hidden">
                <div className="h-full bg-brand-400 rounded-full" style={{ width: `${(cnt / productos.length) * 100}%` }} />
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <CardTitle icon={ChefHat}>Estado de recetas</CardTitle>
          <div className="divide-y divide-border-default">
            {productos.slice(0, 8).map(p => {
              const tiene = !!recetas[p.nombre]
              return (
                <div key={p.nombre} className="flex justify-between items-center py-1.5">
                  <span className="text-xs font-semibold text-text-default truncate max-w-[120px]">{p.nombre}</span>
                  <StatusBadge status={tiene ? 'success' : 'danger'}>
                    {tiene ? 'Con receta' : 'Sin receta'}
                  </StatusBadge>
                </div>
              )
            })}
          </div>
          {productos.length > 8 && (
            <div className="text-[10px] text-text-muted mt-2">
              +{productos.length - 8} productos más
            </div>
          )}
        </Card>
        <Card>
          <CardTitle icon={ShoppingCart}>Últimas ventas</CardTitle>
          {ventasHoy === 0
            ? <EmptyState icon={ShoppingCart} title='Sin ventas hoy' sub='Las ventas aparecerán aquí' />
            : <div className="text-sm font-bold text-text-default">
                {ventasHoy} ventas — {fmt(ingresosHoy)}
              </div>
          }
        </Card>
      </Grid>

    </div>

    {/* Panel derecho — acciones rápidas, WhatsApp y pendientes del día */}
    <div className="space-y-3 min-w-0">
      <AccionesRapidas />
      <PanelWhatsapp activo={esAdmin} />
      <PendientesDelDia sinReceta={sinReceta} ventasHoy={ventasHoy} activo={esAdmin} />
    </div>
    </div>
  )
}
