// pages/Produccion.jsx — v3.0 Órdenes de producción con merma automática y modo oscuro
import { useState, useEffect, useCallback } from 'react'
import { Factory, Plus, CheckCircle, AlertTriangle, ChevronDown, Clock, Package } from 'lucide-react'
import { getRecetas, verificarProduccion, crearOrdenProduccion, getHistorialProduccion } from '../lib/api'
import toast from 'react-hot-toast'

const fmtFecha = f => new Date(f).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' })
const fmtNum   = n => parseFloat(n).toFixed(3).replace(/\.?0+$/, '')

export default function Produccion() {
  const [recetas, setRecetas]           = useState([])
  const [historial, setHistorial]       = useState([])
  const [loadingRec, setLoadingRec]     = useState(true)
  const [loadingHist, setLoadingHist]   = useState(true)
  const [producto, setProducto]         = useState('')
  const [piezas, setPiezas]             = useState('')
  const [notas, setNotas]               = useState('')
  const [verificando, setVerificando]   = useState(false)
  const [confirmando, setConfirmando]   = useState(false)
  const [verificacion, setVerificacion] = useState(null) // resultado del GET /verificar

  const cargarRecetas = useCallback(async () => {
    try {
      const { data } = await getRecetas()
      setRecetas(data.filter(r => r.ingredientes?.length > 0))
    } catch { toast.error('No se pudo cargar las recetas') }
    finally { setLoadingRec(false) }
  }, [])

  const cargarHistorial = useCallback(async () => {
    try {
      const { data } = await getHistorialProduccion()
      setHistorial(data)
    } catch {}
    finally { setLoadingHist(false) }
  }, [])

  useEffect(() => { cargarRecetas(); cargarHistorial() }, [cargarRecetas, cargarHistorial])

  const handleVerificar = async () => {
    if (!producto) { toast.error('Selecciona un producto'); return }
    const p = parseInt(piezas)
    if (!p || p < 1) { toast.error('Ingresa una cantidad válida'); return }
    setVerificando(true)
    setVerificacion(null)
    try {
      const { data } = await verificarProduccion(producto, p)
      setVerificacion(data)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al verificar stock')
    } finally { setVerificando(false) }
  }

  const handleConfirmar = async (forzar = false) => {
    setConfirmando(true)
    try {
      await crearOrdenProduccion({ producto, piezas: parseInt(piezas), notas, forzar })
      toast.success(`Orden de ${piezas} piezas de ${producto} completada`)
      setProducto(''); setPiezas(''); setNotas(''); setVerificacion(null)
      await cargarHistorial()
    } catch (e) {
      const err = e.response?.data
      if (e.response?.status === 409 && err?.faltantes) {
        // Stock insuficiente — ya se muestra en verificacion
        toast.error('Stock insuficiente para completar la orden')
      }
    } finally { setConfirmando(false) }
  }

  const recetaSeleccionada = recetas.find(r => r.producto === producto)

  return (
    <div className="max-w-4xl space-y-4">

      {/* FORMULARIO NUEVA ORDEN */}
      <div className="card">
        <h3 className="text-sm font-medium text-[#1B2A4A] dark:text-gray-200 mb-4 flex items-center gap-2">
          <Factory size={15} className="text-brand-400" /> Nueva orden de producción
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="form-group sm:col-span-2">
            <label className="form-label">Producto</label>
            {loadingRec ? (
              <div className="text-xs text-gray-400 dark:text-gray-500 py-2">Cargando recetas...</div>
            ) : (
              <select value={producto} onChange={e => { setProducto(e.target.value); setVerificacion(null) }}>
                <option value="">Seleccionar producto...</option>
                {recetas.map(r => (
                  <option key={r.id} value={r.producto}>{r.producto} (receta: {r.piezas} pzas)</option>
                ))}
              </select>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Piezas a producir</label>
            <input type="number" value={piezas} onChange={e => { setPiezas(e.target.value); setVerificacion(null) }}
              placeholder="Ej: 200" min="1" step="1" />
          </div>
        </div>

        {producto && piezas && (
          <div className="form-group mb-3">
            <label className="form-label">Notas (opcional)</label>
            <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: Produccion del lunes" />
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={handleVerificar} disabled={verificando || !producto || !piezas}
            className="btn-secondary flex items-center gap-1.5 text-xs">
            <Package size={13} /> {verificando ? 'Verificando...' : 'Verificar stock'}
          </button>
        </div>

        {/* RESULTADO DE VERIFICACION */}
        {verificacion && (
          <div className="mt-4 space-y-3">
            <div className={`rounded-xl p-3 flex items-start gap-2 border ${verificacion.puede_producir ? 'bg-green-50 border-green-100 dark:bg-green-950/20 dark:border-green-800/40' : 'bg-red-50 border-red-100 dark:bg-red-950/20 dark:border-red-800/40'}`}>
              {verificacion.puede_producir
                ? <CheckCircle size={16} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                : <AlertTriangle size={16} className="text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />}
              <div>
                <div className={`text-sm font-semibold ${verificacion.puede_producir ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                  {verificacion.puede_producir
                    ? `Hay stock suficiente para producir ${verificacion.piezas} piezas de ${verificacion.producto}`
                    : `Stock insuficiente para producir ${verificacion.piezas} piezas`}
                </div>
                {recetaSeleccionada && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Factor de escala: x{(verificacion.piezas / verificacion.piezas_base).toFixed(2)} sobre receta base de {verificacion.piezas_base} pzas
                  </div>
                )}
              </div>
            </div>

            {/* TABLA DE INGREDIENTES */}
            <div className="overflow-x-auto">
              <table className="table-base text-xs">
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th className="text-right">Necesario</th>
                    <th className="text-right">Disponible</th>
                    <th className="text-right">Faltante</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {verificacion.ingredientes.map(ing => (
                    <tr key={ing.nombre}>
                      <td className="font-semibold text-gray-700 dark:text-gray-250">{ing.nombre}</td>
                      <td className="text-right">{fmtNum(ing.necesario)} {ing.unidad}</td>
                      <td className="text-right">
                        {ing.sin_inventario
                          ? <span className="text-gray-400 dark:text-gray-500">Sin registro</span>
                          : `${fmtNum(ing.disponible)} ${ing.unidad}`}
                      </td>
                      <td className="text-right">
                        {ing.suficiente ? '—' : <span className="text-red-650 dark:text-red-400 font-bold">{fmtNum(ing.faltante)} {ing.unidad}</span>}
                      </td>
                      <td>
                        {ing.sin_inventario
                          ? <span className="badge-warn">Sin inventario</span>
                          : ing.suficiente
                            ? <span className="badge-ok">OK</span>
                            : <span className="badge-bad">Falta</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* BOTONES DE ACCION */}
            <div className="flex gap-3 pt-2">
              {verificacion.puede_producir ? (
                <button onClick={() => handleConfirmar(false)} disabled={confirmando}
                  className="btn-primary flex items-center gap-1.5 text-xs">
                  <CheckCircle size={13} /> {confirmando ? 'Procesando...' : `Confirmar y descontar inventario`}
                </button>
              ) : (
                <>
                  <button onClick={() => handleConfirmar(true)} disabled={confirmando}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-navy-800 transition-colors">
                    <AlertTriangle size={13} /> {confirmando ? 'Procesando...' : 'Producir de todas formas'}
                  </button>
                  <span className="text-xs text-gray-450 dark:text-gray-500 self-center">El inventario quedará en negativo en los ingredientes faltantes</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* HISTORIAL */}
      <div className="card">
        <h3 className="text-sm font-medium text-[#1B2A4A] dark:text-gray-200 mb-3 flex items-center gap-2">
          <Clock size={14} className="text-brand-400" /> Historial de órdenes
        </h3>
        {loadingHist ? (
          <div className="text-sm text-gray-400 dark:text-gray-500">Cargando...</div>
        ) : historial.length === 0 ? (
          <div className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">Sin órdenes registradas todavía.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base text-xs">
              <thead>
                <tr><th>Fecha</th><th>Producto</th><th className="text-right">Piezas</th><th>Estado</th><th>Registrado por</th><th>Notas</th></tr>
              </thead>
              <tbody>
                {historial.map(o => (
                  <tr key={o.id}>
                    <td className="text-gray-500 dark:text-gray-450 whitespace-nowrap">{fmtFecha(o.creado_en)}</td>
                    <td className="font-semibold text-gray-700 dark:text-gray-250">{o.producto}</td>
                    <td className="text-right font-bold">{o.piezas}</td>
                    <td><span className="badge-ok">Completada</span></td>
                    <td className="text-gray-550 dark:text-gray-400">{o.creado_por_nombre || '—'}</td>
                    <td className="text-gray-400 dark:text-gray-500">{o.notas || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
