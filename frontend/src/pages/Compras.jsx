// ─── pages/Compras.jsx ────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { getCompras, saveFactura } from '../lib/api'
import { Receipt, Plus, Trash2, AlertTriangle, Camera, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL ?? ''

export function Compras() {
  const [historial, setHistorial]   = useState([])
  const [prov, setProv]             = useState('')
  const [fecha, setFecha]           = useState(new Date().toISOString().split('T')[0])
  const [items, setItems]           = useState([{ producto: '', cantidad: 1, precio_actual: '', precio_anterior: '' }])
  const [resultado, setResultado]   = useState(null)
  const [escaneando, setEscaneando] = useState(false)
  const [preview, setPreview]       = useState(null)
  const inputCamRef                 = useRef(null)

  useEffect(() => {
    getCompras().then(r => setHistorial(r.data)).catch(() => {})
  }, [])

  const addItem    = () => setItems(p => [...p, { producto: '', cantidad: 1, precio_actual: '', precio_anterior: '' }])
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i))
  const updateItem = (i, f, v) => setItems(p => p.map((x, idx) => idx === i ? { ...x, [f]: v } : x))

  // ── Captura de factura con cámara ─────────────────────────────
  const abrirCamara = () => inputCamRef.current?.click()

  const procesarImagen = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    // Mostrar preview
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target.result)
    reader.readAsDataURL(file)

    setEscaneando(true)
    toast('Analizando factura con IA…', { icon: '📷' })

    try {
      // Convertir a base64
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload  = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(file)
      })

      // Llamar al backend — evita CORS y mantiene la API key segura
      const token = localStorage.getItem('marquez_token')
      const response = await fetch(`${API}/api/compras/escanear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ imagen: base64, mediaType: file.type || 'image/jpeg' })
      })

      if (!response.ok) throw new Error(`Error ${response.status}`)
      const parsed = await response.json()

      // Rellenar formulario con los datos extraídos
      if (parsed.proveedor) setProv(parsed.proveedor)
      if (parsed.fecha)     setFecha(parsed.fecha)
      if (parsed.items?.length) {
        setItems(parsed.items.map(it => ({
          producto:        it.producto || '',
          cantidad:        it.cantidad || 1,
          precio_actual:   it.precio_actual || '',
          precio_anterior: ''
        })))
      }

      toast.success(`¡Factura escaneada! ${parsed.items?.length || 0} ítems detectados`)
    } catch (err) {
      console.error(err)
      toast.error('No se pudo leer la factura. Ingresa los datos manualmente.')
    } finally {
      setEscaneando(false)
    }
  }

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
      // Solo muestra el análisis, no guarda aún
    } catch (e) {}
  }

  const guardarFactura = async () => {
    const itsValidos = items.filter(i => i.producto && parseFloat(i.precio_actual) > 0)
    if (!itsValidos.length) { toast.error('Agrega al menos un producto con precio'); return }
    try {
      await saveFactura({ proveedor: prov, fecha, items: itsValidos })
      const r = await getCompras()
      setHistorial(r.data)
      toast.success('✅ Factura guardada e inventario actualizado')
      setProv(''); setFecha(new Date().toISOString().split('T')[0])
      setItems([{ producto: '', cantidad: 1, precio_actual: '', precio_anterior: '' }])
      setResultado(null)
    } catch (e) { toast.error('Error al guardar la factura') }
  }

  const varPct = (actual, anterior) => {
    if (!anterior || !actual) return null
    return ((parseFloat(actual) - parseFloat(anterior)) / parseFloat(anterior)) * 100
  }

  return (
    <div className="max-w-3xl space-y-4">

      {/* Preview imagen escaneada */}
      {preview && (
        <div className="card flex items-start gap-3">
          <img src={preview} alt="Factura" className="w-24 h-24 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Factura escaneada</span>
              {escaneando && <Loader2 size={14} className="animate-spin text-amber-500" />}
            </div>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {escaneando ? 'Extrayendo datos con IA…' : 'Datos extraídos. Revisa y ajusta si es necesario.'}
            </p>
          </div>
          <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Registrar factura de compra</h3>
          {/* Input oculto para la cámara */}
          <input
            ref={inputCamRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={procesarImagen}
          />
          <button
            onClick={abrirCamara}
            disabled={escaneando}
            className="btn-secondary flex items-center gap-1.5 text-xs"
            title="Escanear factura con cámara">
            {escaneando
              ? <><Loader2 size={13} className="animate-spin" /> Analizando…</>
              : <><Camera size={13} /> Escanear factura</>
            }
          </button>
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
          <button onClick={analizar} className="btn-secondary flex items-center gap-2"><Receipt size={14} /> Analizar factura</button>
          <button onClick={guardarFactura} className="btn-primary flex items-center gap-2"><Receipt size={14} /> Guardar en inventario</button>
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
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>Análisis — {prov || 'Sin proveedor'} ({fecha})</h3>
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
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>Historial de facturas</h3>
          {historial.slice(0, 5).map((f, i) => (
            <div key={i} className="flex justify-between text-sm py-2 border-b border-gray-50 last:border-0">
              <span style={{ color: 'var(--color-text)' }}>{f.proveedor} — {f.fecha ? new Date(f.fecha).toLocaleDateString('es-NI') : '-'}</span>
              <span className="font-medium">C$ {parseFloat(f.total).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Compras
