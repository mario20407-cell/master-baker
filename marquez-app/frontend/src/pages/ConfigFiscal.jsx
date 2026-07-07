/**
 * ConfigFiscal.jsx — v2.7
 *
 * Cambios vs v2.6:
 *   - Persiste en /api/fiscal (PostgreSQL) vía useFiscalConfig hook.
 *   - Mantiene localStorage como fallback offline.
 *   - Preview de impacto usa calcularCosteoReceta con configFiscal.
 *   - Exporta useFiscalConfig para que Costeo y Escalado lo importen.
 */
import { useState } from 'react'
import { Shield, Save, AlertTriangle, CheckCircle, Calculator, TrendingUp, Info, RefreshCw } from 'lucide-react'
import { useFiscalConfig } from '../hooks/useFiscalConfig'
import { calcularCosteoReceta } from '../lib/costeo'

export { useFiscalConfig }

// Receta de ejemplo: Dona Azucarada
const RECETA_EJEMPLO = {
  piezas: 100,
  merma: 5,
  pventa: 20,
  ingredientes: [
    { cantidad: 1, precio: 45, tipo: 'directo' },
    { cantidad: 0.5, precio: 30, tipo: 'directo' },
    { cantidad: 0.1, precio: 80, tipo: 'indirecto' },
  ],
}

export default function ConfigFiscal() {
  const { config, guardar, loading } = useFiscalConfig()
  const [form, setForm]   = useState(config)
  const [saved, setSaved] = useState(false)

  // Sincronizar form si el hook actualiza config desde la API
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleGuardar = async () => {
    if (!form.regimen) { return }
    if (form.regimen === 'cuota_fija' && !form.cuota_fija) { return }
    if (!form.produccion_mensual) { return }

    const resultado = await guardar(form)
    if (resultado) {
      setForm(resultado)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  // Preview en tiempo real usando el motor de costeo
  const configPreview = {
    configurado: true,
    cuota_fija: parseFloat(form.cuota_fija) || 0,
    produccion_mensual: parseInt(form.produccion_mensual) || 1,
  }
  const conFiscal    = calcularCosteoReceta(RECETA_EJEMPLO, null, configPreview)
  const sinFiscal    = calcularCosteoReceta(RECETA_EJEMPLO, null, null)
  const showPreview  = configPreview.cuota_fija > 0 && configPreview.produccion_mensual > 1

  return (
    <div className="max-w-2xl space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#263D4F' }}>
          <Shield size={18} className="text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Configuración Fiscal</h2>
          <p className="text-xs text-gray-400">Se aplica al costeo de todas las recetas. Guardado en servidor y localStorage.</p>
        </div>
        {config.configurado && (
          <span className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: '#EAF3DE', color: '#27500A' }}>
            <CheckCircle size={11} /> Activo
          </span>
        )}
      </div>

      {/* Aviso legal */}
      <div className="rounded-xl p-3 flex gap-2.5 text-xs" style={{ background: '#FBF6EC', border: '0.5px solid #C29C53' }}>
        <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#A8813E' }} />
        <span style={{ color: '#7A5E2C' }}>
          Orientativo para cálculo interno de márgenes. Para declaraciones ante la DGI consulta a un contador colegiado (CCPN Nicaragua).
        </span>
      </div>

      {/* Datos del negocio */}
      <div className="card space-y-4">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Shield size={14} style={{ color: '#263D4F' }} /> Datos del negocio
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="form-group">
            <label className="form-label">Nombre del negocio</label>
            <input value={form.nombre_negocio || ''} onChange={e => set('nombre_negocio', e.target.value)} placeholder="Master Baker" />
          </div>
          <div className="form-group">
            <label className="form-label">RUC (opcional)</label>
            <input value={form.ruc || ''} onChange={e => set('ruc', e.target.value)} placeholder="J0310000000000" />
          </div>
        </div>
      </div>

      {/* Régimen fiscal */}
      <div className="card space-y-4">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Calculator size={14} style={{ color: '#263D4F' }} /> Régimen fiscal (DGI Nicaragua)
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'cuota_fija',  label: 'Cuota Fija',      desc: 'Ingresos < C$ 1,200,000/año. Pago mensual fijo.' },
            { id: 'reg_general', label: 'Régimen General',  desc: 'Ingresos > C$ 1,200,000/año. Declara IVA e IR.' },
          ].map(r => (
            <button key={r.id} onClick={() => set('regimen', r.id)}
              className="text-left p-3 rounded-xl border transition-all"
              style={{
                borderColor: form.regimen === r.id ? '#263D4F' : '#e5e7eb',
                background:  form.regimen === r.id ? '#EEF1F3' : 'white',
              }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: '#263D4F', background: form.regimen === r.id ? '#263D4F' : 'white' }}>
                  {form.regimen === r.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span className="text-xs font-semibold text-gray-800">{r.label}</span>
              </div>
              <p className="text-[10px] text-gray-400 ml-5">{r.desc}</p>
            </button>
          ))}
        </div>

        {form.regimen === 'cuota_fija' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Cuota Fija mensual DGI (C$)</label>
              <input type="number" value={form.cuota_fija || ''} onChange={e => set('cuota_fija', e.target.value)}
                placeholder="Ej: 300" step="50" min="0" />
              <p className="text-[10px] text-gray-400 mt-1">Revisa tu constancia DGI o llama al 2250-2190</p>
            </div>
            <div className="form-group">
              <label className="form-label">IR anual estimado (C$, opcional)</label>
              <input type="number" value={form.ir_anual || ''} onChange={e => set('ir_anual', e.target.value)}
                placeholder="Ej: 0" step="100" min="0" />
            </div>
          </div>
        )}

        {form.regimen === 'reg_general' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">¿Tus productos tienen IVA 15%?</label>
              <div className="flex gap-2 mt-1">
                {['Algunos', 'Todos', 'Ninguno'].map(op => (
                  <button key={op} onClick={() => set('iva_aplica', op)}
                    className="px-3 py-1.5 text-xs rounded-lg border transition-all"
                    style={{
                      background:  form.iva_aplica === op ? '#263D4F' : 'white',
                      color:       form.iva_aplica === op ? 'white' : '#6b7280',
                      borderColor: form.iva_aplica === op ? '#263D4F' : '#e5e7eb',
                    }}>
                    {op}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">IR sobre utilidades (%)</label>
              <input type="number" value={form.ir_anual || ''} onChange={e => set('ir_anual', e.target.value)}
                placeholder="30" min="0" max="100" />
            </div>
          </div>
        )}
      </div>

      {/* Producción */}
      <div className="card space-y-4">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <TrendingUp size={14} style={{ color: '#263D4F' }} /> Producción mensual estimada
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="form-group">
            <label className="form-label">Total de unidades/mes</label>
            <input type="number" value={form.produccion_mensual || ''}
              onChange={e => set('produccion_mensual', e.target.value)}
              placeholder="Ej: 1350" step="50" min="1" />
            <p className="text-[10px] text-gray-400 mt-1">Suma de todas las piezas producidas al mes</p>
          </div>
          <div className="form-group">
            <label className="form-label">Prorrateo fiscal por pieza</label>
            <div className="py-2 px-3 rounded-lg text-sm font-semibold"
              style={{ background: '#EEF1F3', color: '#263D4F' }}>
              {showPreview
                ? `C$ ${(configPreview.cuota_fija / configPreview.produccion_mensual).toFixed(4)}`
                : '—'}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Cuota Fija ÷ unidades/mes</p>
          </div>
        </div>
      </div>

      {/* Preview usando motor de costeo real */}
      {showPreview && (
        <div className="card" style={{ border: '0.5px solid #C29C53' }}>
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: '#A8813E' }}>
            <Calculator size={14} /> Vista previa — Efecto en Dona Azucarada (C$ 20)
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-1.5 text-gray-500 font-medium">Concepto</th>
                <th className="text-right py-1.5 text-gray-500 font-medium">Sin fiscal</th>
                <th className="text-right py-1.5 text-gray-500 font-medium">Con prorrateo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <tr>
                <td className="py-1.5 text-gray-700">Costo insumos/pieza</td>
                <td className="text-right text-gray-700">C$ {sinFiscal.costoUnitario.toFixed(4)}</td>
                <td className="text-right text-gray-700">C$ {sinFiscal.costoUnitario.toFixed(4)}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-gray-700">Prorrateo DGI/pieza</td>
                <td className="text-right text-gray-400">—</td>
                <td className="text-right font-medium" style={{ color: '#A8813E' }}>
                  + C$ {conFiscal.prorrateoFiscal.toFixed(4)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 font-medium text-gray-800">Costo total/pieza</td>
                <td className="text-right font-medium">C$ {sinFiscal.costoUnitario.toFixed(4)}</td>
                <td className="text-right font-semibold" style={{ color: '#263D4F' }}>
                  C$ {conFiscal.costoFiscalUnitario.toFixed(4)}
                </td>
              </tr>
              <tr className="border-t border-gray-200">
                <td className="py-2 font-semibold text-gray-800">Margen real</td>
                <td className="text-right font-semibold"
                  style={{ color: sinFiscal.aprobado ? '#27500A' : '#A32D2D' }}>
                  {sinFiscal.margen.toFixed(2)}%
                </td>
                <td className="text-right font-bold"
                  style={{ color: conFiscal.aprobadoFiscal ? '#27500A' : '#A32D2D' }}>
                  {conFiscal.margenFiscal.toFixed(2)}%
                </td>
              </tr>
              {!conFiscal.aprobadoFiscal && (
                <tr>
                  <td colSpan={3} className="pt-2">
                    <div className="flex items-start gap-2 p-2 rounded-lg text-xs" style={{ background: '#FCEBEB', color: '#791F1F' }}>
                      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                      <span>
                        Con el prorrateo el margen baja a {conFiscal.margenFiscal.toFixed(1)}%.
                        Precio mínimo recomendado: <strong>C$ {conFiscal.precioMinimoFiscal.toFixed(2)}</strong>
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Botón guardar */}
      <button onClick={handleGuardar} disabled={loading}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all"
        style={{ background: saved ? '#3B6D11' : '#263D4F', opacity: loading ? 0.7 : 1 }}>
        {loading
          ? <><RefreshCw size={15} className="animate-spin" /> Guardando…</>
          : saved
            ? <><CheckCircle size={15} /> Configuración guardada</>
            : <><Save size={15} /> Guardar configuración fiscal</>
        }
      </button>

    </div>
  )
}
