import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useRecetas } from '../hooks/useRecetas'
import { Scale, Copy, ArrowRight, Printer, ChefHat, Check } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Escalado() {
  const location = useLocation()
  const { recetas, loading: loadingRecetas } = useRecetas()

  const [recetaSeleccionada, setRecetaSeleccionada] = useState('')
  const [piezasObjetivo, setPiezasObjetivo] = useState('')
  const [copiado, setCopiado] = useState(false)

  // Cargar receta inicial si viene por redirección
  useEffect(() => {
    const pInicial = location.state?.producto
    if (pInicial && recetas[pInicial]) {
      setRecetaSeleccionada(pInicial)
    }
  }, [recetas, location.state])

  // Resetear input al cambiar de receta
  useEffect(() => {
    if (recetaSeleccionada && recetas[recetaSeleccionada]) {
      setPiezasObjetivo(recetas[recetaSeleccionada].piezas)
    }
  }, [recetaSeleccionada, recetas])

  const r = recetas[recetaSeleccionada]

  // Factor de escala
  const piezasBase = r ? Number(r.piezas) : 1
  const objetivo = piezasObjetivo ? Number(piezasObjetivo) : piezasBase
  const factor = objetivo / piezasBase

  // Merma y piezas estimadas reales
  const mermaPct = r ? Number(r.merma_pct || 0) : 0
  const piezasReales = Math.round(objetivo * (1 - mermaPct / 100))

  const handleCopyClipboard = () => {
    if (!r) return
    let text = `📋 RECETA ESCALADA: ${r.producto}\n`
    text += `🔹 Hornada Objetivo: ${objetivo} piezas\n`
    if (mermaPct > 0) {
      text += `🔹 Piezas Estimadas (con merma de ${mermaPct}%): ${piezasReales} piezas\n`
    }
    text += `------------------------------------------\n`
    text += `Ingredientes requeridos:\n`
    r.ingredientes.forEach(ing => {
      const cantEscalada = (Number(ing.cantidad) * factor).toFixed(3)
      text += `  - ${ing.nombre}: ${cantEscalada} ${ing.unidad} (${ing.tipo || 'directo'})\n`
    })
    if (r.notas) {
      text += `------------------------------------------\n`
      text += `Procedimiento / Notas:\n${r.notas}\n`
    }
    text += `------------------------------------------\n`
    text += `Generado por Master Baker`

    navigator.clipboard.writeText(text)
    setCopiado(true)
    toast.success('Receta copiada al portapapeles')
    setTimeout(() => setCopiado(false), 2000)
  }

  const handlePrint = () => {
    window.print()
  }

  if (loadingRecetas) return <div className="p-6 text-center text-gray-500">Cargando recetas...</div>

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* CARD CONFIGURADOR */}
      <div className="card shadow-md bg-white border border-gray-100 rounded-xl p-6 no-print">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4" style={{ color: '#263D4F' }}>
          <Scale style={{ color: '#C29C53' }} size={20} /> Escalador de Hornada para el Taller
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Receta Base</label>
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
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Total Piezas Objetivo</label>
            <input
              type="number"
              disabled={!r}
              min="1"
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-yellow-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
              value={piezasObjetivo}
              onChange={e => setPiezasObjetivo(e.target.value)}
              placeholder="Ej. 200"
            />
          </div>
        </div>

        {!r && (
          <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed text-gray-400 text-sm">
            Elige una receta base para calcular las proporciones a llevar al taller.
          </div>
        )}
      </div>

      {r && (
        /* VISTA DE LA RECETA ESCALADA */
        <div className="card shadow-lg bg-white border border-gray-100 rounded-xl p-6 print:p-0 print:border-none print:shadow-none">
          {/* Cabecera de Impresión */}
          <div className="flex justify-between items-start border-b pb-4 mb-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold no-print">Hoja de Producción</span>
              <h3 className="text-2xl font-bold text-gray-900 leading-tight">{r.producto}</h3>
              <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-500 font-medium">
                <span>Base: {piezasBase} pzs</span>
                <ArrowRight size={14} />
                <span className="text-lg font-bold" style={{ color: '#C29C53' }}>Escalado: {objetivo} piezas</span>
              </div>
            </div>
            {/* Acciones */}
            <div className="flex gap-2 no-print">
              <button
                onClick={handleCopyClipboard}
                className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
              >
                {copiado ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                {copiado ? 'Copiado' : 'Copiar Receta'}
              </button>
              <button
                onClick={handlePrint}
                className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 text-white rounded-lg"
                style={{ background: '#263D4F' }}
              >
                <Printer size={14} /> Imprimir Hoja
              </button>
            </div>
          </div>

          {/* INDICADOR RÁPIDO */}
          <div className="grid grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl border mb-6 no-print">
            <div className="text-center border-r">
              <span className="text-[9px] uppercase font-semibold text-gray-400">Factor Multiplicador</span>
              <div className="text-lg font-bold text-gray-800">x{factor.toFixed(2)}</div>
            </div>
            <div className="text-center border-r">
              <span className="text-[9px] uppercase font-semibold text-gray-400">Merma Esperada</span>
              <div className="text-lg font-bold text-red-500">{mermaPct}%</div>
            </div>
            <div className="text-center">
              <span className="text-[9px] uppercase font-semibold text-gray-400">Piezas Horneadas Netas</span>
              <div className="text-lg font-bold text-green-600">{piezasReales} piezas</div>
            </div>
          </div>

          {/* TABLA DE INGREDIENTES ESCALADA */}
          <div className="mb-6">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 print:text-sm print:text-gray-700">
              Proporciones de Ingredientes
            </h4>
            <div className="border rounded-xl overflow-hidden shadow-sm print:border-gray-300">
              <table className="min-w-full bg-white divide-y divide-gray-150">
                <thead className="bg-gray-50 print:bg-gray-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase print:text-gray-700">Ingrediente</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase print:text-gray-700">Cantidad Base</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase w-48 text-brand-600 print:text-gray-900" style={{ color: '#C29C53' }}>
                      Cantidad Escalada
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 print:divide-gray-300">
                  {r.ingredientes.map((ing, idx) => {
                    const cantEscalada = Number(ing.cantidad) * factor
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{ing.nombre}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-500">
                          {Number(ing.cantidad).toFixed(3)} {ing.unidad}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 bg-yellow-50/30 print:bg-transparent">
                          {cantEscalada.toFixed(3)} {ing.unidad}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* NOTAS / PROCEDIMIENTO */}
          {r.notes || r.notas ? (
            <div className="p-4 bg-yellow-50/40 border border-yellow-100 rounded-xl print:bg-transparent print:border-gray-300">
              <h4 className="text-xs font-bold uppercase text-yellow-800 flex items-center gap-1.5 mb-2 print:text-gray-700">
                <ChefHat size={14} /> Notas / Instrucciones de Preparación
              </h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {r.notes || r.notas}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}