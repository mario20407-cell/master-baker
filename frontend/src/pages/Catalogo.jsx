// ─── pages/Catalogo.jsx ───────────────────────────────────────────────────────
// v2.8.1 — Edición protegida con PIN de Admin + historial de auditoría + Modo Oscuro.
import { useState, useEffect, useCallback } from 'react'
import {
  getCatalogo, updateProducto, updateProductosPorCategoria, getAuditoriaProductos,
} from '../lib/api'
import { CAT_COLORS } from '../lib/catalogo'
import { Search, Calculator, Scale, Pencil, Check, X, Percent, RefreshCw, History } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import AdminPinModal from '../components/AdminPinModal'

const fmt = v => 'C$ ' + (parseFloat(v) || 0).toFixed(2)

export function Catalogo() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [q, setQ]                 = useState('')
  const [cat, setCat]             = useState('Todos')
  const [editando, setEditando]   = useState(null)
  const [precioTmp, setPrecioTmp] = useState('')
  const [nombreTmp, setNombreTmp] = useState('')
  const [categoriaTmp, setCategoriaTmp] = useState('')
  const [panelMasivo, setPanelMasivo] = useState(false)
  const [catMasivo, setCatMasivo] = useState('Todos')
  const [pctMasivo, setPctMasivo] = useState('')
  const [pinAccion, setPinAccion] = useState(null)  // función a ejecutar tras confirmar PIN
  const [panelAuditoria, setPanelAuditoria] = useState(false)
  const [auditoria, setAuditoria] = useState([])
  const navigate = useNavigate()

  const cargar = useCallback(async () => {
    try {
      const { data } = await getCatalogo()
      setProductos(data)
    } catch {
      toast.error('No se pudo cargar el catálogo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const categorias = [...new Set(productos.map(p => p.categoria))].sort()

  const lista = productos.filter(p =>
    (cat === 'Todos' || p.categoria === cat) &&
    (!q || p.nombre.toLowerCase().includes(q.toLowerCase()))
  )

  // ── Edición individual — requiere PIN ───────────────────────────────────
  const [categoriaNueva, setCategoriaNueva] = useState(false)

  const empezarEdicion = (p) => {
    setEditando(p.id)
    setPrecioTmp(String(p.precio))
    setNombreTmp(p.nombre)
    setCategoriaTmp(p.categoria)
    setCategoriaNueva(false)
  }

  const confirmarEdicion = (p) => {
    const nuevoPrecio = parseFloat(precioTmp)
    if (!nuevoPrecio || nuevoPrecio <= 0) { toast.error('Precio inválido'); return }
    const nuevoNombre = nombreTmp.trim()
    if (!nuevoNombre) { toast.error('El nombre no puede quedar vacío'); return }
    const nuevaCategoria = categoriaTmp.trim()
    if (!nuevaCategoria) { toast.error('La categoría no puede quedar vacía'); return }
    setPinAccion(() => async (pin) => {
      try {
        await updateProducto(p.id, {
          precio: nuevoPrecio, presentacion: p.presentacion,
          nombre: nuevoNombre, categoria: nuevaCategoria,
        }, pin)
        setProductos(prev => prev.map(x => x.id === p.id
          ? { ...x, precio: nuevoPrecio, nombre: nuevoNombre, categoria: nuevaCategoria }
          : x))
        toast.success(`${nuevoNombre} actualizado`)
        setEditando(null)
      } catch (e) {
        toast.error(e.response?.data?.error || 'No se pudo guardar el producto')
      }
    })
  }

  const cancelarEdicion = () => setEditando(null)

  // ── Edición masiva — requiere PIN ───────────────────────────────────────
  const confirmarMasivo = () => {
    const pct = parseFloat(pctMasivo)
    if (!pct && pct !== 0) { toast.error('Ingresa un porcentaje'); return }
    const verbo = pct >= 0 ? 'subir' : 'bajar'
    const objetivo = catMasivo === 'Todos' ? 'TODO el catálogo' : `la categoría "${catMasivo}"`
    if (!confirm(`¿Vas a ${verbo} ${Math.abs(pct)}% el precio de ${objetivo}?`)) return

    setPinAccion(() => async (pin) => {
      try {
        const { data } = await updateProductosPorCategoria(catMasivo, pct, pin)
        toast.success(`${data.actualizados} productos actualizados`)
        await cargar()
        setPanelMasivo(false)
        setPctMasivo('')
      } catch (e) {
        toast.error(e.response?.data?.error || 'No se pudo aplicar el ajuste masivo')
      }
    })
  }

  // ── Auditoría ────────────────────────────────────────────────────────────
  const verAuditoria = async () => {
    try {
      const { data } = await getAuditoriaProductos(30)
      setAuditoria(data)
      setPanelAuditoria(true)
    } catch {
      toast.error('No se pudo cargar el historial')
    }
  }

  if (loading) return <div className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">Cargando catálogo…</div>

  return (
    <div className="max-w-5xl">
      <div className="flex gap-3 mb-4 items-start flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="pl-8 w-full" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar producto..." />
        </div>
        <button onClick={() => setPanelMasivo(p => !p)}
          className="btn-secondary flex items-center gap-1.5 text-xs whitespace-nowrap">
          <Percent size={13} /> Ajuste masivo
        </button>
        <button onClick={verAuditoria}
          className="btn-secondary flex items-center gap-1.5 text-xs whitespace-nowrap">
          <History size={13} /> Historial de cambios
        </button>
      </div>

      {panelMasivo && (
        <div className="card mb-4 border border-[#C29C53] dark:border-brand-600">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Ajustar precios por porcentaje</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select value={catMasivo} onChange={e => setCatMasivo(e.target.value)}>
                <option value="Todos">Todo el catálogo</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Porcentaje (+ sube, − baja)</label>
              <input type="number" value={pctMasivo} onChange={e => setPctMasivo(e.target.value)}
                placeholder="Ej: 5 o -5" step="0.5" />
            </div>
            <button onClick={confirmarMasivo} className="btn-primary flex items-center justify-center gap-1.5">
              <RefreshCw size={13} /> Aplicar ajuste
            </button>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
            Requiere PIN de administrador. Los precios se redondean a 2 decimales.
          </p>
        </div>
      )}

      {panelAuditoria && (
        <div className="card mb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Últimos cambios al catálogo</h3>
            <button onClick={() => setPanelAuditoria(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X size={15} />
            </button>
          </div>
          {auditoria.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">Sin cambios registrados todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base text-xs">
                <thead><tr><th>Fecha</th><th>Producto</th><th>Campo</th><th className="text-right">Antes</th><th className="text-right">Ahora</th><th>Método</th></tr></thead>
                <tbody>
                  {auditoria.map(a => {
                    const esPrecio = a.campo === 'precio' || !a.campo
                    return (
                      <tr key={a.id}>
                        <td className="text-gray-500 dark:text-gray-450">{new Date(a.creado_en).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="font-semibold">{a.entidad_nombre}</td>
                        <td className="text-gray-500 dark:text-gray-450 capitalize">{a.campo || 'precio'}</td>
                        <td className="text-right text-gray-400 dark:text-gray-500">{esPrecio ? fmt(a.valor_anterior) : (a.valor_anterior_texto || '—')}</td>
                        <td className="text-right font-bold text-brand-600 dark:text-brand-400">{esPrecio ? fmt(a.valor_nuevo) : (a.valor_nuevo_texto || '—')}</td>
                        <td><span className="badge-gray">{a.metodo === 'individual' ? 'Individual' : a.metodo === 'masivo_lista' ? 'Masivo' : `${a.porcentaje_aplicado > 0 ? '+' : ''}${a.porcentaje_aplicado}%`}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap mb-4">
        {['Todos', ...categorias].map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-3 py-1 text-xs rounded-lg border transition-all ${cat === c
              ? 'border-brand-400 text-white font-medium bg-[#C29C53] dark:bg-brand-600'
              : 'border-gray-200 dark:border-navy-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-navy-600'}`}
          >
            {c}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">Sin productos en esta categoría.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {lista.map(p => {
            const color = CAT_COLORS[p.categoria] || { bg: '#F1EFE8', text: '#444441' }
            const costoMax = (p.precio * 0.43).toFixed(2)
            const estaEditando = editando === p.id
            return (
              <div key={p.id} className="card hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                      style={{ background: color.bg, color: color.text }}>{p.categoria}</span>
                    {p.tiene_receta && <span className="badge-ok text-[9px] font-bold">Receta ✓</span>}
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 leading-tight">
                    {estaEditando ? (
                      <input
                        autoFocus value={nombreTmp} onChange={e => setNombreTmp(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') cancelarEdicion() }}
                        className="text-sm font-medium w-full py-0.5 mb-1"
                        placeholder="Nombre del producto"
                      />
                    ) : p.nombre}
                  </div>

                  {estaEditando && (
                    <div className="mb-1">
                      {categoriaNueva ? (
                        <input
                          autoFocus value={categoriaTmp} onChange={e => setCategoriaTmp(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Escape') cancelarEdicion() }}
                          className="text-xs w-full py-0.5"
                          placeholder="Nombre de la nueva categoría"
                        />
                      ) : (
                        <select
                          value={categoriaTmp}
                          onChange={e => {
                            if (e.target.value === '__nueva__') { setCategoriaNueva(true); setCategoriaTmp('') }
                            else setCategoriaTmp(e.target.value)
                          }}
                          className="text-xs w-full py-0.5"
                        >
                          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="__nueva__">+ Nueva categoría...</option>
                        </select>
                      )}
                    </div>
                  )}

                  {estaEditando ? (
                    <div className="flex items-center gap-1 mb-1">
                      <input
                        type="number" value={precioTmp}
                        onChange={e => setPrecioTmp(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') confirmarEdicion(p)
                          if (e.key === 'Escape') cancelarEdicion()
                        }}
                        className="text-lg font-bold w-20 py-0.5 text-brand-600 dark:text-brand-400"
                        step="0.5"
                      />
                      <button onClick={() => confirmarEdicion(p)} className="p-1 rounded hover:bg-green-50 dark:hover:bg-green-950/30 text-green-600">
                        <Check size={14} />
                      </button>
                      <button onClick={cancelarEdicion} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-550">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => empezarEdicion(p)} className="flex items-center gap-1.5 mb-1 group">
                      <span className="text-lg font-bold text-brand-650 dark:text-brand-400">{fmt(p.precio)}</span>
                      <Pencil size={11} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </button>
                  )}

                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-3">{p.presentacion}</div>
                </div>

                <div>
                  <div className="text-[11px] text-gray-500 dark:text-amber-400 mb-3 p-2 rounded-lg bg-[#FAEEDA] dark:bg-amber-950/20">
                    Costo máx (57%): <strong>C$ {costoMax}</strong>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => navigate('/costeo', { state: { producto: p.nombre } })}
                      className="flex-1 btn-primary text-xs py-1.5 flex items-center justify-center gap-1">
                      <Calculator size={11} /> Costear
                    </button>
                    <button onClick={() => navigate('/escalado', { state: { producto: p.nombre } })}
                      className="flex-1 btn-secondary text-xs py-1.5 flex items-center justify-center gap-1">
                      <Scale size={11} /> Escalar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AdminPinModal
        abierto={!!pinAccion}
        onCerrar={() => { setPinAccion(null); setEditando(null) }}
        onConfirmar={(pin) => { pinAccion?.(pin); setPinAccion(null) }}
      />
    </div>
  )
}

export default Catalogo