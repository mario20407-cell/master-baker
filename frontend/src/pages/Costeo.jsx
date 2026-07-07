import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useRecetas } from '../hooks/useRecetas'
import { useFiscalConfig } from '../hooks/useFiscalConfig'
import { PRODUCTOS } from '../lib/catalogo'
import { Calculator, AlertTriangle, CheckCircle, Shield } from 'lucide-react'
import { calcularCosteoReceta } from '../lib/costeo'
import { saveCosteo } from '../lib/api'
import toast from 'react-hot-toast'

const fmt = (v) => 'C$ ' + (parseFloat(v) || 0).toFixed(2)

export default function Costeo() {
  const { recetas }               = useRecetas()
  const { config: configFiscal }  = useFiscalConfig()

  const [prodIdx,    setProdIdx]    = useState('')
  const [piezas,     setPiezas]     = useState('')
  const [pventa,     setPventa]     = useState('')
  const [resultado,  setResultado]  = useState(null)

  const location = useLocation()

  useEffect(() => {
    if (location.state?.producto && recetas && Object.keys(recetas).length > 0) {
      const idx = PRODUCTOS.findIndex(p => p.n === location.state.producto)
      if (idx >= 0) {
        const p = PRODUCTOS[idx]
        setProdIdx(idx.toString())
        setPventa(p.p)
        const r = recetas[p.n]
        if (r) {
          setPiezas(r.piezas)
          const recetaConPventa = {
            ...r,
            pventa: p.p,
            ingredientes: r.ingredientes || [],
          }
          const res = calcularCosteoReceta(recetaConPventa, r.piezas, configFiscal)
          setResultado({ ...res, producto: p.n, piezasObj: r.piezas })
        }
      }
    }
  }, [location.state, recetas, configFiscal])

  const prod   = prodIdx !== '' ? PRODUCTOS[parseInt(prodIdx)] : null
  const receta = prod ? recetas[prod.n] : null

  const handleProdChange = (idx) => {
    setProdIdx(idx)
    if (idx !== '') {
      const p = PRODUCTOS[parseInt(idx)]
      setPventa(p.p)
      const r = recetas[p.n]
      if (r) setPiezas(r.piezas)
    }
    setResultado(null)
  }

  const calcular = async () => {
    if (!prod)   { toast.error('Selecciona un producto'); return }
    if (!receta) { toast.error('Este producto no tiene receta guardada'); return }
    if (!piezas) { toast.error('Ingresa las piezas a producir'); return }

    const recetaConPventa = {
      ...receta,
      pventa:      parseFloat(pventa) || prod.p,
      ingredientes: receta.ingredientes || [],
    }

    const res = calcularCosteoReceta(
      recetaConPventa,
      parseInt(piezas),
      configFiscal,       // null si no configurado → campos fiscales en null
    )

    setResultado({ ...res, producto: prod.n, piezasObj: parseInt(piezas) })

    try {
      await saveCosteo({
        producto:              prod.n,
        piezas_obj:            parseInt(piezas),
        piezas_reales:         res.piezasReales,
        costo_directo:         res.costoDirecto,
        costo_indirecto:       res.costoIndirecto,
        costo_total:           res.costoTotal,
        costo_unitario:        res.costoUnitario,
        precio_venta:          res.pventa,
        margen_pct:            res.margen,
        margen_fiscal_pct:     res.margenFiscal,
        costo_fiscal_unitario: res.costoFiscalUnitario,
        utilidad_neta:         res.utilidad,
        aprobado:              res.aprobado,
        aprobado_fiscal:       res.aprobadoFiscal,
        factor_escala:         res.factor,
      })
    } catch (_) {}
  }

  const r = resultado

  return (
    <div className="max-w-2xl space-y-4">
      <div className="card">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Costeo automático desde receta</h3>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="form-group">
            <label className="form-label">Producto con receta</label>
            <select value={prodIdx} onChange={e => handleProdChange(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {PRODUCTOS.map((p, i) => (
                <option key={i} value={i}>
                  {recetas[p.n] ? '✓ ' : '○ '}{p.n} — C$ {p.p}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Piezas a producir</label>
            <input type="number" value={piezas} onChange={e => setPiezas(e.target.value)} placeholder="100" min="1" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="form-group">
            <label className="form-label">Precio de venta (C$)</label>
            <input type="number" value={pventa} onChange={e => setPventa(e.target.value)} step="0.01" />
          </div>
          <div className="form-group">
            <label className="form-label">Estado de receta</label>
            <div className="flex items-center gap-2 py-2">
              {!prod ? (
                <span className="text-xs text-gray-400">Sin producto seleccionado</span>
              ) : receta ? (
                <span className="badge-ok flex items-center gap-1">
                  <CheckCircle size={11} /> Receta disponible ({receta.ingredientes?.length} ingredientes)
                </span>
              ) : (
                <span className="badge-bad flex items-center gap-1">
                  <AlertTriangle size={11} /> Sin receta — ir a módulo Recetas
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Indicador fiscal activo */}
        {configFiscal?.configurado && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-xs"
            style={{ background: '#EEF1F3', color: '#263D4F' }}>
            <Shield size={13} />
            Prorrateo DGI activo — C$ {(configFiscal.cuota_fija / configFiscal.produccion_mensual).toFixed(4)}/pieza incluido en costeo
          </div>
        )}

        {receta && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="text-xs text-gray-500 mb-2 font-medium">
              Ingredientes de la receta base ({receta.piezas} piezas)
            </div>
            <div className="overflow-x-auto">
              <table className="table-base text-xs">
                <thead><tr><th>Ingrediente</th><th>Base</th><th>Escalado</th><th>Unidad</th></tr></thead>
                <tbody>
                  {receta.ingredientes?.map((ing, i) => {
                    const factor = piezas ? parseInt(piezas) / receta.piezas : 1
                    return (
                      <tr key={i}>
                        <td>
                          {ing.nombre}{' '}
                          <span className={ing.tipo === 'indirecto' ? 'badge-info text-[10px]' : 'badge-gray text-[10px]'}>
                            {ing.tipo}
                          </span>
                        </td>
                        <td>{ing.cantidad} {ing.unidad}</td>
                        <td className="font-medium">{(ing.cantidad * factor).toFixed(3)} {ing.unidad}</td>
                        <td>{ing.unidad}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button onClick={calcular} className="btn-primary flex items-center gap-2" disabled={!receta}>
          <Calculator size={14} /> Calcular costeo completo
        </button>
      </div>

      {r && (
        <>
          {/* Alerta de margen — sin fiscal */}
          {r.pventa > 0 && (
            r.aprobado ? (
              <div className="alert-ok">
                <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-green-800">Margen aprobado — {r.margen.toFixed(1)}%</div>
                  <div className="text-xs text-green-700 mt-0.5">
                    Operación viable. Utilidad neta del lote: {fmt(r.utilidad)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="alert-bad">
                <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-red-800">ALERTA CRÍTICA — Violación de margen</div>
                  <div className="text-xs text-red-700 mt-0.5">
                    Margen: {r.margen.toFixed(1)}% (objetivo ≥57%).
                    Precio mínimo requerido: {fmt(r.precioMinimo)}
                  </div>
                </div>
              </div>
            )
          )}

          {/* Alerta fiscal adicional si el margen base pasa pero el fiscal no */}
          {r.fiscalActivo && r.aprobado && r.aprobadoFiscal === false && (
            <div className="alert-warn">
              <Shield size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#A8813E' }} />
              <div>
                <div className="font-medium" style={{ color: '#7A5E2C' }}>
                  Margen cae bajo el mínimo al incluir prorrateo DGI — {r.margenFiscal.toFixed(1)}%
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#7A5E2C' }}>
                  Precio mínimo con fiscal: {fmt(r.precioMinimoFiscal)}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Resultado — {r.producto} ({r.piezasObj} piezas)
            </h3>

            {/* KPIs — con columna fiscal si está activo */}
            <div className={`grid gap-3 mb-4 ${r.fiscalActivo ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'}`}>
              {[
                ['Costo total lote',   fmt(r.costoTotal)],
                ['Costo unitario',     fmt(r.costoUnitario)],
                ['Precio mínimo',      fmt(r.precioMinimo)],
                ['Margen neto',        r.margen.toFixed(1) + '%'],
              ].map(([l, v]) => (
                <div key={l} className="kpi-card">
                  <div className="text-xs text-gray-400 mb-1">{l}</div>
                  <div className="text-lg font-semibold text-gray-900">{v}</div>
                </div>
              ))}
            </div>

            <table className="table-base">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th className="text-right">Sin fiscal</th>
                  {r.fiscalActivo && <th className="text-right">Con DGI</th>}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Costos directos</td>
                  <td className="text-right">{fmt(r.costoDirecto)}</td>
                  {r.fiscalActivo && <td className="text-right">{fmt(r.costoDirecto)}</td>}
                </tr>
                <tr>
                  <td>Costos indirectos</td>
                  <td className="text-right">{fmt(r.costoIndirecto)}</td>
                  {r.fiscalActivo && <td className="text-right">{fmt(r.costoIndirecto)}</td>}
                </tr>
                {r.fiscalActivo && (
                  <tr>
                    <td>Prorrateo DGI/pieza × {r.piezasReales} pzs</td>
                    <td className="text-right text-gray-400">—</td>
                    <td className="text-right font-medium" style={{ color: '#A8813E' }}>
                      {fmt(r.prorrateoFiscal * r.piezasReales)}
                    </td>
                  </tr>
                )}
                <tr className="font-medium">
                  <td>Costo total</td>
                  <td className="text-right">{fmt(r.costoTotal)}</td>
                  {r.fiscalActivo && (
                    <td className="text-right" style={{ color: '#263D4F' }}>
                      {fmt(r.costoTotal + r.prorrateoFiscal * r.piezasReales)}
                    </td>
                  )}
                </tr>
                <tr>
                  <td>Costo unitario</td>
                  <td className="text-right">{fmt(r.costoUnitario)}</td>
                  {r.fiscalActivo && (
                    <td className="text-right font-medium" style={{ color: '#263D4F' }}>
                      {fmt(r.costoFiscalUnitario)}
                    </td>
                  )}
                </tr>
                <tr>
                  <td>Piezas reales (−{receta?.merma_pct || 0}% merma)</td>
                  <td className="text-right">{r.piezasReales}</td>
                  {r.fiscalActivo && <td className="text-right">{r.piezasReales}</td>}
                </tr>
                {r.pventa > 0 && (
                  <>
                    <tr>
                      <td>Precio de venta</td>
                      <td className="text-right">{fmt(r.pventa)}</td>
                      {r.fiscalActivo && <td className="text-right">{fmt(r.pventa)}</td>}
                    </tr>
                    <tr>
                      <td>Precio mínimo (57%)</td>
                      <td className="text-right">{fmt(r.precioMinimo)}</td>
                      {r.fiscalActivo && (
                        <td className="text-right" style={{ color: r.aprobadoFiscal ? '#27500A' : '#A32D2D' }}>
                          {fmt(r.precioMinimoFiscal)}
                        </td>
                      )}
                    </tr>
                    <tr>
                      <td>Utilidad neta</td>
                      <td className="text-right font-medium" style={{ color: '#27500A' }}>{fmt(r.utilidad)}</td>
                      {r.fiscalActivo && (
                        <td className="text-right font-medium" style={{ color: r.aprobadoFiscal ? '#27500A' : '#A32D2D' }}>
                          {fmt(r.pventa * r.piezasReales - (r.costoTotal + r.prorrateoFiscal * r.piezasReales))}
                        </td>
                      )}
                    </tr>
                    <tr>
                      <td>Margen neto</td>
                      <td className="text-right">
                        <span className={r.aprobado ? 'badge-ok' : 'badge-bad'}>
                          {r.margen.toFixed(1)}%
                        </span>
                      </td>
                      {r.fiscalActivo && (
                        <td className="text-right">
                          <span className={r.aprobadoFiscal ? 'badge-ok' : 'badge-bad'}>
                            {r.margenFiscal.toFixed(1)}%
                          </span>
                        </td>
                      )}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
