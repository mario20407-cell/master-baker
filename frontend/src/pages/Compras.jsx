// ─── pages/Compras.jsx ────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import api, { getCompras, getInventario, saveFactura } from '../lib/api'
import { hoyNicaragua } from '../lib/fecha'
import { Receipt, Plus, Trash2, AlertTriangle, Camera } from 'lucide-react'
import toast from 'react-hot-toast'

export function Compras() {
  const [historial, setHistorial] = useState([])
  const [prov, setProv] = useState('')
  const [fecha, setFecha] = useState(hoyNicaragua())
  const [items, setItems] = useState([{ producto: '', cantidad: 1, precio_actual: '', precio_anterior: '' }])
  const [resultado, setResultado] = useState(null)
  const [insumos, setInsumos] = useState([])
  const [procesandoIA, setProcesandoIA] = useState(false)

  useEffect(() => {
    getCompras().then(r => setHistorial(r.data)).catch(() => {})
    getInventario().then(r => setInsumos(r.data || [])).catch(() => {})
  }, [])

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setProcesandoIA(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const base64Content = reader.result.split(',')[1]
        const mimeType = file.type

        const { data } = await api.post('/ai/analizar-pdf', {
          fileBase64: base64Content,
          mimeType,
          tipo: 'factura'
        })

        if (data && data.datos) {
          const parsed = data.datos
          setProv(parsed.proveedor || '')
          
          if (parsed.fecha) {
            try {
              const dateObj = new Date(parsed.fecha)
              if (!isNaN(dateObj.getTime())) {
                setFecha(dateObj.toISOString().slice(0, 10))
              }
            } catch (err) {}
          }
          
          if (parsed.items && parsed.items.length > 0) {
            const mappedItems = parsed.items.map(it => {
              const searchName = (it.producto || '').toLowerCase()
              const match = insumos.find(ins => {
                const insName = ins.nombre.toLowerCase()
                return insName.includes(searchName) || searchName.includes(insName)
              })
              return {
                producto: match ? match.nombre : (it.producto || ''),
                cantidad: it.cantidad || 1,
                precio_actual: it.precio_unitario || '',
                precio_anterior: match ? match.costo_unitario : ''
              }
            })
            setItems(mappedItems)
          }
          toast.success('Factura procesada y autopoblada con éxito')
        } else {
          toast.error('No se pudieron extraer datos de la factura')
        }
      } catch (err) {
        console.error('Error al procesar con IA:', err)
        toast.error('Error al analizar la factura con IA')
      } finally {
        setProcesandoIA(false)
        e.target.value = ''
      }
    }
    reader.readAsDataURL(file)
  }

  const addItem = () => setItems(p => [...p, { producto: '', cantidad: 1, precio_actual: '', precio_anterior: '' }])
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i))
  const updateItem = (i, f, v) => setItems(p => p.map((x, idx) => idx === i ? { ...x, [f]: v } : x))

  const analizar = async () => {
    const itsValidos = items.filter(i => i.producto && parseFloat(i.precio_actual) > 0)
    if (!itsValidos.length) { toast.error('Agrega al menos un producto con precio'); return }

    const alertas = itsValidos.filter(i => {
      if (!i.precio_anterior) return false
      const pct = ((parseFloat(i.precio_actual) - parseFloat(i.precio_anterior)) / parseFloat(i.precio_anterior)) * 100
      return pct > 10
    })

    setResultado({ items: itsValidos, alertas, total: itsValidos.reduce((s, i) => s + i.cantidad * parseFloat(i.precio_actual), 0) })

    try {
      const { data } = await saveFactura({ proveedor: prov, fecha, items: itsValidos })
      const r = await getCompras()
      setHistorial(r.data)
      toast.success(`Factura guardada — ${data.insumosActualizados} insumos actualizados en inventario`)
    } catch (e) {
      toast.error('No se pudo guardar la factura')
    }
  }

  const varPct = (actual, anterior) => {
    if (!anterior || !actual) return null
    return ((parseFloat(actual) - parseFloat(anterior)) / parseFloat(anterior)) * 100
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="card">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Registrar factura de compra</h3>

        {/* Banner de Carga con Cámara / Archivo para OCR */}
        <div className="mb-4 p-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition-all text-center">
          <input
            type="file"
            accept="image/*,application/pdf"
            id="scan-factura"
            className="hidden"
            onChange={handleFileChange}
            disabled={procesandoIA}
          />
          {procesandoIA ? (
            <div className="flex flex-col items-center justify-center space-y-2 py-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" style={{ borderBottomColor: '#C29C53' }}></div>
              <p className="text-xs font-medium text-gray-600">Procesando factura con IA de Gemini...</p>
              <p className="text-[10px] text-gray-400">Extrayendo productos, cantidades y precios automáticamente</p>
            </div>
          ) : (
            <label htmlFor="scan-factura" className="cursor-pointer flex flex-col items-center justify-center space-y-2 py-2">
              <div className="p-3 bg-white rounded-full shadow-sm text-brand-500 hover:scale-105 transition-transform" style={{ color: '#C29C53' }}>
                <Camera size={24} />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-700 block">Escanear / Subir Factura</span>
                <span className="text-[10px] text-gray-400 block mt-0.5">Toma una foto desde el celular o selecciona un archivo (PDF/Imagen)</span>
              </div>
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="form-group"><label className="form-label">Proveedor</label><input value={prov} onChange={e => setProv(e.target.value)} placeholder="Distribuidora X" /></div>
          <div className="form-group"><label className="form-label">Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 mb-1">
          {['Producto', 'Cant.', 'Precio actual', 'Precio anterior', ''].map((h, i) => <div key={i} className="text-xs text-gray-400">{h}</div>)}
        </div>
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 mb-2">
            <input value={it.producto} onChange={e => updateItem(i, 'producto', e.target.value)} placeholder="Harina 50kg" />
            <input type="number" value={it.cantidad} onChange={e => updateItem(i, 'cantidad', e.target.value)} min="1" />
            <input type="number" value={it.precio_actual} onChange={e => updateItem(i, 'precio_actual', e.target.value)} placeholder="0.00" step="0.01" />
            <input type="number" value={it.precio_anterior} onChange={e => updateItem(i, 'precio_anterior', e.target.value)} placeholder="0.00" step="0.01" />
            <button onClick={() => removeItem(i)} className="btn-danger p-1.5"><Trash2 size={12} /></button>
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <button onClick={addItem} className="btn-secondary flex items-center gap-1 text-xs"><Plus size={12} /> Ítem</button>
          <button onClick={analizar} className="btn-primary flex items-center gap-2"><Receipt size={14} /> Analizar factura</button>
        </div>
      </div>

      {resultado && (
        <div className="space-y-3">
          {resultado.alertas.map((it, i) => {
            const pct = varPct(it.precio_actual, it.precio_anterior)
            return (
              <div key={i} className="alert-bad">
                <AlertTriangle size={17} className="text-red-600 flex-shrink-0" />
                <div><strong>ALERTA DE COSTO — {it.producto}</strong><div className="text-xs mt-0.5">Variación: +{pct?.toFixed(1)}% (supera umbral del 10%). Revisar impacto en márgenes.</div></div>
              </div>
            )
          })}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Análisis — {prov || 'Sin proveedor'} ({fecha})</h3>
            <table className="table-base">
              <thead><tr><th>Producto</th><th>Cant.</th><th className="text-right">Precio</th><th className="text-right">Subtotal</th><th>Variación</th></tr></thead>
              <tbody>
                {resultado.items.map((it, i) => {
                  const pct = varPct(it.precio_actual, it.precio_anterior)
                  const bc = pct === null ? 'badge-gray' : pct > 10 ? 'badge-bad' : pct < -5 ? 'badge-ok' : 'badge-warn'
                  return (
                    <tr key={i}>
                      <td>{it.producto}</td>
                      <td>{it.cantidad}</td>
                      <td className="text-right">C$ {parseFloat(it.precio_actual).toFixed(2)}</td>
                      <td className="text-right">C$ {(it.cantidad * parseFloat(it.precio_actual)).toFixed(2)}</td>
                      <td>{pct !== null ? <span className={bc}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span> : <span className="badge-gray">—</span>}</td>
                    </tr>
                  )
                })}
                <tr className="font-medium"><td colSpan={3}>Total factura</td><td className="text-right">C$ {resultado.total.toFixed(2)}</td><td></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {historial.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-medium text-gray-600 mb-3">Historial de facturas</h3>
          {historial.slice(0, 5).map((f, i) => (
            <div key={i} className="flex justify-between text-sm py-2 border-b border-gray-50 last:border-0">
              <span className="text-gray-700">{f.proveedor} — {f.fecha}</span>
              <span className="font-medium">C$ {parseFloat(f.total).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Compras
