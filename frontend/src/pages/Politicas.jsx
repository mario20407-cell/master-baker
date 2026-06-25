// pages/Politicas.jsx — Políticas de producción Master Baker
import { useState } from 'react'
import { Shield, CheckCircle, AlertTriangle, Printer } from 'lucide-react'

const AREAS = ['Todas', 'Producción', 'Compras', 'Inventario', 'Ventas']

const POLITICAS = [
  { id: 'P1', area: 'Producción', titulo: 'Margen mínimo de rentabilidad', descripcion: 'Ningún producto puede producirse con margen menor al 40%. El sistema bloquea órdenes que no cumplan este umbral hasta aprobación del administrador.', impacto: 'Alto', implementada: true },
  { id: 'P2', area: 'Producción', titulo: 'Stock mínimo antes de producir', descripcion: 'El sistema verifica inventario antes de cada orden. Si algún insumo no alcanza para el lote completo, se bloquea la orden y se genera alerta de compra.', impacto: 'Alto', implementada: true },
  { id: 'P3', area: 'Producción', titulo: 'Trazabilidad de lotes', descripcion: 'Cada hornada registra: fecha, turno, operario y cantidad producida. Obligatorio para productos de alto costo.', impacto: 'Medio', implementada: false },
  { id: 'P4', area: 'Producción', titulo: 'Merma máxima permitida', descripcion: 'La merma diaria no puede superar el 5% de lo producido. Si se supera, el sistema genera alerta y el administrador debe justificar la causa.', impacto: 'Medio', implementada: true },
  { id: 'P5', area: 'Producción', titulo: 'Escalado autorizado', descripcion: 'Los operarios pueden escalar recetas pero no modificar ingredientes ni proporciones. Solo el administrador puede editar recetas base.', impacto: 'Alto', implementada: true },
  { id: 'P6', area: 'Compras', titulo: 'Compra mínima por proveedor', descripcion: 'No se registran compras menores a C$500 para evitar fragmentación de pedidos y gastos de transporte innecesarios.', impacto: 'Bajo', implementada: false },
  { id: 'P7', area: 'Compras', titulo: 'Cotizaciones para compras mayores', descripcion: 'Para compras mayores a C$2,000 en un solo insumo, se requiere comparar al menos 2 proveedores antes de registrar la compra.', impacto: 'Medio', implementada: false },
  { id: 'P8', area: 'Compras', titulo: 'Actualización de precios obligatoria', descripcion: 'Cada vez que se registra una compra, el sistema actualiza automáticamente el precio del insumo en inventario. No se permiten precios desactualizados por más de 30 días.', impacto: 'Alto', implementada: true },
  { id: 'P9', area: 'Compras', titulo: 'Proveedor preferencial por insumo', descripcion: 'Cada insumo crítico (harina, azúcar, manteca) debe tener un proveedor principal y uno alternativo registrado para garantizar abastecimiento.', impacto: 'Medio', implementada: false },
  { id: 'P10', area: 'Inventario', titulo: 'Conteo semanal obligatorio', descripcion: 'Cada lunes el administrador verifica el inventario físico contra el sistema. Diferencias mayores al 2% deben justificarse con nota.', impacto: 'Alto', implementada: false },
  { id: 'P11', area: 'Inventario', titulo: 'FIFO — primero en entrar, primero en salir', descripcion: 'Los insumos más antiguos deben usarse primero. El sistema ordena los insumos por fecha de entrada para facilitar este control.', impacto: 'Medio', implementada: false },
  { id: 'P12', area: 'Inventario', titulo: 'Alerta de insumos sin movimiento', descripcion: 'Si un insumo lleva más de 15 días sin movimiento, el sistema genera alerta para revisar si sigue siendo necesario o debe liquidarse.', impacto: 'Bajo', implementada: false },
  { id: 'P13', area: 'Ventas', titulo: 'Precio mínimo de venta', descripcion: 'Ningún operario puede aplicar descuentos que lleven el precio por debajo del mínimo calculado por el sistema. Solo el administrador puede autorizar descuentos especiales.', impacto: 'Alto', implementada: true },
  { id: 'P14', area: 'Ventas', titulo: 'Ajuste de precios por temporada', descripcion: 'El sistema sugiere ajuste de precios antes de temporadas altas (Semana Santa, Navidad, fiestas patrias). El administrador aprueba o rechaza los ajustes sugeridos por la IA.', impacto: 'Medio', implementada: false },
  { id: 'P15', area: 'Ventas', titulo: 'Cierre diario de caja', descripcion: 'Al final de cada jornada se registra el total de ventas, se compara con la producción del día y se calcula la utilidad neta. El reporte se genera automáticamente en PDF.', impacto: 'Alto', implementada: true },
]

const colorImpacto = { Alto: { bg: '#fee2e2', color: '#dc2626' }, Medio: { bg: '#fef3c7', color: '#d97706' }, Bajo: { bg: '#dcfce7', color: '#16a34a' } }

export default function Politicas() {
  const [area, setArea] = useState('Todas')
  const [filtroEstado, setFiltroEstado] = useState('Todas')

  const filtradas = POLITICAS.filter(p =>
    (area === 'Todas' || p.area === area) &&
    (filtroEstado === 'Todas' || (filtroEstado === 'Activas' ? p.implementada : !p.implementada))
  )

  const activas = POLITICAS.filter(p => p.implementada).length
  const pendientes = POLITICAS.filter(p => !p.implementada).length
  const cumplimiento = Math.round((activas / POLITICAS.length) * 100)

  return (
    <div className="max-w-4xl space-y-4">
      <style>{`@media print { .no-print { display: none !important; } body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .print-area { position: fixed; top: 0; left: 0; width: 100%; } }`}</style>

      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Shield size={18} className="text-amber-600" /> Políticas de Producción
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Marco normativo de operaciones — Master Baker v3.2</p>
        </div>
        <button onClick={() => window.print()} className="btn-primary flex items-center gap-2 no-print">
          <Printer size={14} /> Imprimir / PDF
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 no-print">
        <div className="kpi-card text-center">
          <div className="text-2xl font-bold text-green-600">{activas}</div>
          <div className="text-xs text-gray-400 mt-1">Políticas activas</div>
        </div>
        <div className="kpi-card text-center">
          <div className="text-2xl font-bold text-amber-600">{pendientes}</div>
          <div className="text-xs text-gray-400 mt-1">En implementación</div>
        </div>
        <div className="kpi-card text-center">
          <div className="text-2xl font-bold" style={{ color: cumplimiento >= 70 ? '#16a34a' : '#d97706' }}>{cumplimiento}%</div>
          <div className="text-xs text-gray-400 mt-1">Cumplimiento</div>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${cumplimiento}%`, background: cumplimiento >= 70 ? '#16a34a' : '#d97706' }} />
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap no-print">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {AREAS.map(a => (
            <button key={a} onClick={() => setArea(a)}
              className={`px-3 py-1 text-xs rounded-lg transition-all ${area === a ? 'bg-white font-medium shadow-sm' : 'text-gray-500'}`}>
              {a}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {['Todas', 'Activas', 'Pendientes'].map(e => (
            <button key={e} onClick={() => setFiltroEstado(e)}
              className={`px-3 py-1 text-xs rounded-lg transition-all ${filtroEstado === e ? 'bg-white font-medium shadow-sm' : 'text-gray-500'}`}>
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="print-area space-y-3">
        {filtradas.map(p => (
          <div key={p.id} className="card" style={{ borderLeft: `4px solid ${p.implementada ? '#16a34a' : '#d97706'}` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="flex-shrink-0 mt-0.5">
                  {p.implementada ? <CheckCircle size={18} className="text-green-500" /> : <AlertTriangle size={18} className="text-amber-500" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-bold text-gray-400">{p.id}</span>
                    <span className="text-sm font-semibold text-gray-800">{p.titulo}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#eff6ff', color: '#1d4ed8' }}>{p.area}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: colorImpacto[p.impacto].bg, color: colorImpacto[p.impacto].color }}>Impacto {p.impacto}</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{p.descripcion}</p>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0 ${p.implementada ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {p.implementada ? '✓ Activa' : '⏳ Pendiente'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400 text-center pt-2 no-print">
        {filtradas.length} de {POLITICAS.length} políticas — Master Baker v3.2
      </div>
    </div>
  )
}
