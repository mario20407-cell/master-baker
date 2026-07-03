import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useRecetas } from '../hooks/useRecetas'
import { useFiscalConfig } from '../hooks/useFiscalConfig'
import { saveCosteo, getCosteos } from '../lib/api'
import { calcularCosteoReceta } from '../lib/costeo'
import { Calculator, Save, AlertTriangle, CheckCircle, ShieldAlert, History, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Costeo() {
  const location = useLocation()
  const { recetas, loading: loadingRecetas } = useRecetas()
  const { config: configFiscal } = useFiscalConfig()

  const [recetaSeleccionada, setRecetaSeleccionada] = useState('')
  const [piezasObjetivo, setPiezasObjetivo] = useState('')
  const [precioVenta, setPrecioVenta] = useState('')
  const [historial, setHistorial] = useState([])
  const [guardando, setGuardando] = useState(false)

  // Cargar histórico de costeos
  const cargarHistorial = () => {
    getCosteos()
      .then(({ data }) => setHistorial(data))
      .catch(() => {})
  }

  useEffect(() => {
    cargarHistorial()
  }, [])

  // Cargar producto inicial si viene por redirección
  useEffect(() => {
    const pInicial = location.state?.producto
    if (pInicial && recetas[pInicial]) {
      setRecetaSeleccionada(pInicial)
    }
  }, [recetas, location.state])

  // Resetear inputs al cambiar de receta
  useEffect(() => {
    if (recetaSeleccionada && recetas[recetaSeleccionada]) {
      const r = recetas[recetaSeleccionada]
      setPiezasObjetivo(r.piezas)
      setPrecioVenta(r.pventa || '')
    }
  }, [recetaSeleccionada, recetas])

  const r = recetas[recetaSeleccionada]

  // Realizar cálculos en caliente usando el motor centralizado
  const calculo = r
    ? calcularCosteoReceta(
        { ...r, pventa: Number(precioVenta) || 0 },
        piezasObjetivo ? Number(piezasObjetivo) : null,
        configFiscal
      )
    : null

  const handleSaveCosteo = async () => {
    if (!calculo) return
    setGuardando(true)
    try {
      await saveCosteo({
        producto: r.producto,
        piezas_obj: Number(piezasObjetivo || r.piezas),
        piezas_reales: calculo.piezasReales,
        costo_directo: calculo.costoDirecto,
        costo_indirecto: calculo.costoIndirecto,
        costo_total: calculo.costoTotal,
        costo_unitario: calculo.costoUnitario,
        precio_venta: Number(precioVenta),
        margen_pct: calculo.margen,
        margen_fiscal_pct: calculo.margenFiscal,
        costo_fiscal_unitario: calculo.costoFiscalUnitario,
        utilidad_neta: calculo.utilidad,
        aprobado_fiscal: calculo.aprobadoFiscal,
        factor_escala: calculo.factor
      })
      toast.success('Costeo guardado con éxito')
      cargarHistorial()
    } catch (e) {
      toast.error('Error al guardar costeo')
    } finally {
      setGuardando(false)
    }
  }

  if (loadingRecetas) return <div className="p-6 text-center text-gray-500">Cargando datos...</div>

  return (
    <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* SECCIÓN IZQUIERDA: CONFIGURADOR DE COSTES */}
      <div className="lg:col-span-2 space-y-6">
        <div className="card shadow-md bg-white border border-gray-100 rounded-xl p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4" style={{ color: '#263D4F' }}>
            <Calculator style={{ color: '#C29C53' }} size={20} /> Análisis de Costo por Hornada
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Receta</label>
              <select
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-yellow-400"
                value={recetaSeleccionada}
                onChange={e => setRecetaSeleccionada(e.target.value)}
              >
                <option value="">-- Selecciona una receta --</option>
                {Object.keys(recetas).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Piezas Objetivo</label>
              <input
                type="number"
                disabled={!r}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-yellow-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                value={piezasObjetivo}
                onChange={e => setPiezasObjetivo(e.target.value)}
                placeholder="Ej. 100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Precio Venta Unitario (C$)</label>
              <input
                type="number"
                disabled={!r}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-yellow-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                value={precioVenta}
                onChange={e => setPrecioVenta(e.target.value)}
                placeholder="Ej. 25.00"
              />
            </div>
          </div>

          {!r ? (
            <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed text-gray-400 text-sm">
              Selecciona una receta arriba para iniciar el desglose de costeos.
            </div>
          ) : (
            <div className="space-y-6">
              {/* STATUS INDICATOR (APROBADO MARGEN >= 57%) */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
                  calculo.aprobado
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {calculo.aprobado ? (
                  <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                ) : (
                  <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                )}
                <div>
                  <div className="font-bold text-sm">
                    {calculo.aprobado
                      ? 'Rentabilidad Aprobada (Mínimo 57%)'
                      : 'Rentabilidad Insuficiente (Menor a 57%)'}
                  </div>
                  <div className="text-xs mt-0.5">
                    El margen neto de este producto es de{' '}
                    <strong>{calculo.margen.toFixed(1)}%</strong>.
                    {!calculo.aprobado &&
                      ` Necesitas un precio de venta sugerido mínimo de C$ ${calculo.precioMinimo.toFixed(
                        2
                      )} para alcanzar la meta.`}
                  </div>
                </div>
              </div>

              {/* DESGLOSE FISCAL DGI SI ESTÁ ACTIVO */}
              {calculo.fiscalActivo && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
                    calculo.aprobadoFiscal
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : 'bg-orange-50 border-orange-200 text-orange-800'
                  }`}
                >
                  <ShieldAlert className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                  <div>
                    <div className="font-bold text-sm">Margen Ajustado con Impuestos (DGI)</div>
                    <div className="text-xs mt-0.5">
                      Prorrateo fiscal por pieza: <strong>C$ {calculo.prorrateoFiscal.toFixed(2)}</strong>.
                      El costo ajustado es de <strong>C$ {calculo.costoFiscalUnitario.toFixed(2)}</strong>, dejando un margen fiscal real de{' '}
                      <strong>{calculo.margenFiscal.toFixed(1)}%</strong> (
                      {calculo.aprobadoFiscal ? 'APROBADO' : 'NO RECOMENDADO'}).
                    </div>
                  </div>
                </div>
              )}

              {/* CARD DE RESULTADOS TÉCNICOS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl border">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-gray-400">Total Producido</span>
                  <div className="text-lg font-bold text-gray-800">{calculo.piezasReales} piezas</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-gray-400">Costo Hornada</span>
                  <div className="text-lg font-bold text-gray-800">C$ {calculo.costoTotal.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-gray-400">Costo Unitario</span>
                  <div className="text-lg font-bold text-gray-800">C$ {calculo.costoUnitario.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-gray-400">Utilidad Total</span>
                  <div className="text-lg font-bold text-green-600">C$ {calculo.utilidad.toFixed(2)}</div>
                </div>
              </div>

              {/* GUARDADO DE HISTORIAL */}
              <div className="flex justify-end pt-3">
                <button
                  disabled={guardando || !precioVenta}
                  onClick={handleSaveCosteo}
                  className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
                  style={{ background: '#263D4F' }}
                >
                  <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar en Historial'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN DERECHA: HISTÓRICO DE COSTEOS */}
      <div className="card shadow-md bg-white border border-gray-100 rounded-xl p-5 flex flex-col h-[600px] overflow-hidden">
        <h2 className="text-md font-bold flex items-center gap-2 mb-4 border-b pb-3" style={{ color: '#263D4F' }}>
          <History size={16} style={{ color: '#C29C53' }} /> Historial de Análisis
        </h2>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {historial.length === 0 ? (
            <div className="text-center text-gray-400 text-xs py-10">No hay costeos guardados recientemente.</div>
          ) : (
            historial.map(h => (
              <div key={h.id} className="p-3 border rounded-xl hover:bg-gray-50 transition-colors bg-white">
                <div className="flex justify-between items-start mb-1.5">
                  <h4 className="font-semibold text-sm text-gray-900 leading-tight">{h.producto}</h4>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      h.aprobado ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {h.margen_pct}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-[11px] text-gray-500">
                  <div className="flex justify-between pr-2">
                    <span>Piezas:</span>
                    <strong className="text-gray-700">{h.piezas_obj}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Costo U:</span>
                    <strong className="text-gray-700">C$ {Number(h.costo_unitario).toFixed(1)}</strong>
                  </div>
                  <div className="flex justify-between pr-2">
                    <span>Precio V:</span>
                    <strong className="text-gray-700">C$ {Number(h.precio_venta).toFixed(1)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Utilidad:</span>
                    <strong className="text-green-600">C$ {Number(h.utilidad_neta).toFixed(0)}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400 border-t pt-1.5">
                  <Calendar size={10} />
                  <span>{new Date(h.creado_en).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}