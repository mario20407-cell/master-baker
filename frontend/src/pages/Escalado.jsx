import { useState } from 'react'
import { useRecetas } from '../hooks/useRecetas'
import { useFiscalConfig } from '../hooks/useFiscalConfig'
import { useCatalogo } from '../hooks/useCatalogo'
import { Scale, Plus, Trash2, AlertTriangle, CheckCircle, Shield } from 'lucide-react'
import { calcularCosteoReceta } from '../lib/costeo'
import toast from 'react-hot-toast'

const fmt = v => 'C$ ' + (parseFloat(v) || 0).toFixed(2)

export default function Escalado() {
  const { recetas }              = useRecetas()
  const { productos }            = useCatalogo()
  const { config: configFiscal } = useFiscalConfig()

  const [prodNombre, setProdNombre] = useState('')
  const [base,       setBase]       = useState('')
  const [target,     setTarget]     = useState('')
  const [peso,       setPeso]       = useState('')
  const [merma,      setMerma]      = useState('')
  const [ings, setIngs] = useState([
    { nombre: 'Harina', cantidad: '', unidad: 'kg', precio: 0, tipo: 'directo' },
  ])
  const [resultado, setResultado] = useState(null)

  const prod   = prodNombre ? productos.find(p => p.nombre === prodNombre) : null
  const receta = prod ? recetas[prod.nombre] : null

  const handleProdChange = (nombre) => {
    setProdNombre(nombre)
    setResultado(null)
    if (!nombre) return
    const r = recetas[nombre]
    if (r) {
      setBase(r.piezas)
      setPeso(r.peso_por_pieza || '')
      setMerma(r.merma_pct || '')
      setIngs(r.ingredientes?.map(i => ({
        nombre:   i.nombre,
        cantidad: i.cantidad,
        unidad:   i.unidad,
        precio:   i.precio || 0,
        tipo:     i.tipo || 'directo',
      })) || ings)
    }
  }

  const addIng    = () => setIngs(p => [...p, { nombre: '', cantidad: '', unidad: 'kg', precio: 0, tipo: 'directo' }])
  const removeIng = (i) => setIngs(p => p.filter((_, idx) => idx !== i))
  const updateIng = (i, field, val) => setIngs(p => p.map((x, idx) => idx === i ? { ...x, [field]: val } : x))

  const calcular = () => {
    const b = parseFloat(base), t = parseFloat(target)
    if (!b || !t) { toast.error('Ingresa receta base y piezas objetivo'); return }

    // Construir receta sintética para pasarla al motor
    const recetaSintetica = {
      piezas:       b,
      merma:        parseFloat(merma) || 0,
      pventa:       prod?.p || 0,
      ingredientes: ings
        .filter(i => i.nombre && parseFloat(i.cantidad) > 0)
        .map(i => ({
          cantidad: parseFloat(i.cantidad),
          precio:   parseFloat(i.precio) || 0,
          tipo:     i.tipo || 'directo',
        })),
    }

    const res = calcularCosteoReceta(recetaSintetica, t, configFiscal)

    const pesog     = parseFloat(peso) || 0
    const pesoTotal = (t * pesog) / 1000

    setResultado({
      ...res,
      piezasObj:    t,
      pesoTotal,
      ingsEscalados: ings
        .filter(i => i.nombre && parseFloat(i.cantidad) > 0)
        .map(i => ({
          ...i,
          escalado: (parseFloat(i.cantidad) * res.factor).toFixed(4),
        })),
    })
  }

  const r = resultado

  return (
    <div className="max-w-2xl space-y-4">
      <div className="card">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Motor de escalado</h3>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="form-group">
            <label className="form-label">Producto (opcional)</label>
            <select value={prodNombre} onChange={e => handleProdChange(e.target.value)}>
              <option value="">— Sin seleccionar —</option>
              {productos.map((p) => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">% merma estimada</label>
            <input type="number" value={merma} onChange={e => setMerma(e.target.value)} placeholder="5" min="0" max="40" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="form-group">
            <label className="form-label">Piezas base de receta</label>
            <input type="number" value={base} onChange={e => setBase(e.target.value)} placeholder="100" min="1" />
          </div>
          <div className="form-group">
            <label className="form-label">Piezas a producir</label>
            <input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="500" min="1" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="form-group">
            <label className="form-label">Peso por pieza (g)</label>
            <input type="number" value={peso} onChange={e => setPeso(e.target.value)} placeholder="80" />
          </div>
          <div className="form-group">
            <label className="form-label">Precio de venta (C$)</label>
            <input type="number" value={prod?.p || ''} readOnly
              className="bg-gray-50 text-gray-500 cursor-not-allowed"
              placeholder={prod ? `${prod.precio} (del catálogo)` : 'Selecciona producto'} />
          </div>
        </div>

        {/* Indicador fiscal */}
        {configFiscal?.configurado && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-xs"
            style={{ background: '#EEF1F3', color: '#263D4F' }}>
            <Shield size={13} />
            Prorrateo DGI activo — C$ {(configFiscal.cuota_fija / configFiscal.produccion_mensual).toFixed(4)}/pieza
          </div>
        )}

        <div className="mb-3">
          <div className="flex justify-between items-center mb-2">
            <label className="form-label" style={{ marginBottom: 0 }}>
              Ingredientes base ({base || 'X'} piezas)
            </label>
            <button onClick={addIng} className="btn-secondary text-xs px-2 py-1 flex items-center gap-1">
              <Plus size={11} /> Agregar
            </button>
          </div>
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 mb-1">
            {['Ingrediente', 'Cantidad', 'C$/unidad', 'Tipo', ''].map((h, i) => (
              <div key={i} className="text-xs text-gray-400">{h}</div>
            ))}
          </div>
          {ings.map((ing, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 mb-2">
              <input value={ing.nombre} onChange={e => updateIng(i, 'nombre', e.target.value)} placeholder="Ingrediente" />
              <input type="number" value={ing.cantidad} onChange={e => updateIng(i, 'cantidad', e.target.value)} placeholder="0" step="0.001" />
              <input type="number" value={ing.precio} onChange={e => updateIng(i, 'precio', e.target.value)} placeholder="0.00" step="0.01" />
              <select value={ing.tipo} onChange={e => updateIng(i, 'tipo', e.target.value)}>
                <option value="directo">Directo</option>
                <option value="indirecto">Indirecto</option>
              </select>
              <button onClick={() => removeIng(i)} className="btn-danger p-1.5"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>

        <button onClick={calcular} className="btn-primary flex items-center gap-2">
          <Scale size={14} /> Escalar producción
        </button>
      </div>

      {r && (
        <>
          {/* Alerta base */}
          {r.pventa > 0 && r.costoUnitario > 0 && (
            r.aprobado
              ? <div className="alert-ok">
                  <CheckCircle size={17} className="text-green-600 flex-shrink-0" />
                  <div>
                    <strong>Margen aprobado — {r.margen.toFixed(1)}%</strong>
                    <div className="text-xs mt-0.5">Costo unitario: {fmt(r.costoUnitario)} · Precio venta: {fmt(r.pventa)}</div>
                  </div>
                </div>
              : <div className="alert-bad">
                  <AlertTriangle size={17} className="text-red-600 flex-shrink-0" />
                  <div>
                    <strong>Violación de margen — {r.margen.toFixed(1)}%</strong>
                    <div className="text-xs mt-0.5">Precio mínimo requerido: {fmt(r.precioMinimo)}</div>
                  </div>
                </div>
          )}

          {/* Alerta fiscal si aplica */}
          {r.fiscalActivo && r.aprobado && r.aprobadoFiscal === false && (
            <div className="alert-warn">
              <Shield size={16} className="flex-shrink-0" style={{ color: '#A8813E' }} />
              <div>
                <strong style={{ color: '#7A5E2C' }}>
                  Con prorrateo DGI el margen cae a {r.margenFiscal.toFixed(1)}%
                </strong>
                <div className="text-xs mt-0.5" style={{ color: '#7A5E2C' }}>
                  Precio mínimo con fiscal: {fmt(r.precioMinimoFiscal)}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Resultado — factor ×{r.factor.toFixed(2)}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                ['Piezas objetivo',          r.piezasObj],
                [`Piezas reales (−${merma||0}%)`, r.piezasReales],
                ['Peso total masa',          r.pesoTotal.toFixed(2) + ' kg'],
                ['Factor escala',            '×' + r.factor.toFixed(2)],
              ].map(([l, v]) => (
                <div key={l} className="kpi-card">
                  <div className="text-xs text-gray-400 mb-1">{l}</div>
                  <div className="text-lg font-semibold text-gray-900">{v}</div>
                </div>
              ))}
            </div>

            {/* Tabla de costeo sin/con fiscal */}
            {r.costoUnitario > 0 && (
              <table className="table-base mb-4">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th className="text-right">Sin fiscal</th>
                    {r.fiscalActivo && <th className="text-right">Con DGI</th>}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Costo total lote</td>
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
                  {r.pventa > 0 && (
                    <>
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
            )}

            {/* Tabla de ingredientes escalados */}
            {r.ingsEscalados.length > 0 && (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th className="text-right">Base ({base}pz)</th>
                    <th className="text-right">Escalado ({target}pz)</th>
                    <th>Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {r.ingsEscalados.map((ing, i) => (
                    <tr key={i}>
                      <td>
                        {ing.nombre}{' '}
                        <span className={ing.tipo === 'indirecto' ? 'badge-info text-[10px]' : 'badge-gray text-[10px]'}>
                          {ing.tipo}
                        </span>
                      </td>
                      <td className="text-right">{ing.cantidad}</td>
                      <td className="text-right font-medium" style={{ color: '#C29C53' }}>{ing.escalado}</td>
                      <td>{ing.unidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
