import { useState } from 'react'
import { useRecetas } from '../hooks/useRecetas'
import { PRODUCTOS, CAT_COLORS } from '../lib/catalogo'
import { ChefHat, Plus, Search, Upload, Edit2, Trash2, Calculator, CheckCircle, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

const UNIDADES = ['kg', 'g', 'L', 'ml', 'unidad', 'porción']

function IngredienteRow({ ing, onChange, onDelete }) {
  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center mb-2">
      <input
        value={ing.nombre} placeholder="Ingrediente"
        onChange={e => onChange({ ...ing, nombre: e.target.value })}
        className={ing.tipo === 'indirecto' ? 'bg-blue-50' : ''}
      />
      <input type="number" value={ing.cantidad} placeholder="0" step="0.001" min="0"
        onChange={e => onChange({ ...ing, cantidad: parseFloat(e.target.value) || 0 })} />
      <select value={ing.unidad} onChange={e => onChange({ ...ing, unidad: e.target.value })}>
        {UNIDADES.map(u => <option key={u}>{u}</option>)}
      </select>
      <input type="number" value={ing.precio} placeholder="C$/u" step="0.01" min="0"
        onChange={e => onChange({ ...ing, precio: parseFloat(e.target.value) || 0 })} />
      <button onClick={onDelete} className="btn-danger p-1.5">
        <Trash2 size={13} />
      </button>
    </div>
  )
}

function FormReceta({ inicial, onGuardar, onCancelar }) {
  const prodIdx = PRODUCTOS.findIndex(p => p.n === inicial?.producto)
  const [prodSel, setProdSel] = useState(prodIdx >= 0 ? prodIdx : '')
  const [piezas, setPiezas] = useState(inicial?.piezas || '')
  const [peso, setPeso] = useState(inicial?.peso || '')
  const [merma, setMerma] = useState(inicial?.merma || '')
  const [notas, setNotas] = useState(inicial?.notas || '')
  const [ings, setIngs] = useState(inicial?.ingredientes || [
    { nombre: 'Harina',                 cantidad: '', unidad: 'kg',     precio: '', tipo: 'directo' },
    { nombre: 'Azúcar',                 cantidad: '', unidad: 'kg',     precio: '', tipo: 'directo' },
    { nombre: 'Huevos',                 cantidad: '', unidad: 'unidad', precio: '', tipo: 'directo' },
    { nombre: 'Margarina',              cantidad: '', unidad: 'kg',     precio: '', tipo: 'directo' },
    { nombre: 'Gas (indirecto)',        cantidad: '', unidad: 'porción',precio: '', tipo: 'indirecto' },
    { nombre: 'Mano de obra (indirecto)', cantidad: '', unidad: 'porción', precio: '', tipo: 'indirecto' },
    { nombre: 'Empaque',                cantidad: '', unidad: 'unidad', precio: '', tipo: 'directo' },
  ])

  const addIng = (tipo = 'directo') =>
    setIngs(prev => [...prev, { nombre: '', cantidad: '', unidad: 'kg', precio: '', tipo }])

  const updateIng = (i, val) => setIngs(prev => prev.map((x, idx) => idx === i ? val : x))
  const removeIng = (i) => setIngs(prev => prev.filter((_, idx) => idx !== i))

  const handleGuardar = () => {
    if (prodSel === '') { toast.error('Selecciona un producto'); return }
    if (!piezas) { toast.error('Ingresa las piezas que rinde'); return }
    const ingsValidos = ings.filter(i => i.nombre && parseFloat(i.cantidad) > 0)
    if (!ingsValidos.length) { toast.error('Agrega al menos un ingrediente con cantidad'); return }
    const prod = PRODUCTOS[parseInt(prodSel)]
    onGuardar({
      producto: prod.n, categoria: prod.cat, pventa: prod.p, presentacion: prod.pr,
      piezas: parseInt(piezas), peso: parseFloat(peso) || 0,
      merma: parseFloat(merma) || 0, notas,
      ingredientes: ingsValidos.map(i => ({
        ...i, cantidad: parseFloat(i.cantidad), precio: parseFloat(i.precio) || 0
      }))
    })
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Datos de la receta</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="form-group">
            <label className="form-label">Producto del catálogo</label>
            <select value={prodSel} onChange={e => setProdSel(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {PRODUCTOS.map((p, i) => (
                <option key={i} value={i}>{p.n} — C$ {p.p}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Piezas que rinde la receta</label>
            <input type="number" value={piezas} onChange={e => setPiezas(e.target.value)} placeholder="Ej: 100" min="1" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="form-group">
            <label className="form-label">Peso por pieza (g)</label>
            <input type="number" value={peso} onChange={e => setPeso(e.target.value)} placeholder="Ej: 80" />
          </div>
          <div className="form-group">
            <label className="form-label">% merma estimada</label>
            <input type="number" value={merma} onChange={e => setMerma(e.target.value)} placeholder="Ej: 5" min="0" max="40" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notas / observaciones</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Temperatura de horneado, tiempo, observaciones..." rows={2} />
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-medium text-gray-700">Ingredientes</h3>
          <div className="flex gap-2">
            <button onClick={() => addIng('directo')} className="btn-secondary text-xs px-2 py-1 flex items-center gap-1">
              <Plus size={12} /> Directo
            </button>
            <button onClick={() => addIng('indirecto')} className="btn-secondary text-xs px-2 py-1 flex items-center gap-1" style={{ color: '#185FA5' }}>
              <Plus size={12} /> Indirecto
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 mb-2">
          {['Ingrediente', 'Cantidad', 'Unidad', 'C$/unidad', ''].map((h, i) => (
            <div key={i} className="text-xs text-gray-400 font-medium">{h}</div>
          ))}
        </div>

        {ings.map((ing, i) => (
          <IngredienteRow key={i} ing={ing}
            onChange={val => updateIng(i, val)}
            onDelete={() => removeIng(i)} />
        ))}

        <div className="flex gap-2 mt-1 text-xs text-gray-400">
          <span className="badge-gray">Directo</span> ingredientes físicos &nbsp;
          <span className="badge-info">Indirecto</span> gas, energía, mano de obra
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleGuardar} className="btn-primary flex items-center gap-2">
          <CheckCircle size={14} /> Guardar receta
        </button>
        {onCancelar && (
          <button onClick={onCancelar} className="btn-secondary">Cancelar</button>
        )}
      </div>
    </div>
  )
}

export default function Recetas() {
  const { recetas, loading, guardar, eliminar } = useRecetas()
  const [vista, setVista] = useState('lista') // lista | nueva | editar | pegar
  const [editando, setEditando] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [pegado, setPegado] = useState('')
  const [pegProd, setPegProd] = useState('')
  const [pegPiezas, setPegPiezas] = useState('')
  const [detalle, setDetalle] = useState(null)

  const lista = Object.values(recetas).filter(r =>
    !busqueda || r.producto.toLowerCase().includes(busqueda.toLowerCase())
  )

  const handleGuardar = async (datos) => {
    await guardar(datos)
    setVista('lista')
    setEditando(null)
  }

  const handleEditar = (receta) => {
    setEditando(receta)
    setVista('editar')
  }

  const handleEliminar = async (nombre) => {
    if (confirm(`¿Eliminar receta de "${nombre}"?`)) await eliminar(nombre)
  }

  const importarPegado = async () => {
    if (!pegProd || !pegPiezas) { toast.error('Selecciona producto y piezas'); return }
    const lineas = pegado.trim().split('\n').filter(Boolean)
    const ings = []
    lineas.forEach(l => {
      const cols = l.split(/\t|,|;/).map(c => c.trim())
      if (cols.length >= 2) {
        const nombre = cols[0]; const cantidad = parseFloat(cols[1]) || 0
        const unidad = cols[2] || 'kg'; const precio = parseFloat(cols[3]) || 0
        if (nombre && cantidad > 0)
          ings.push({ nombre, cantidad, unidad, precio, tipo: nombre.toLowerCase().includes('indirecto') ? 'indirecto' : 'directo' })
      }
    })
    if (!ings.length) { toast.error('No se encontraron ingredientes válidos'); return }
    const prod = PRODUCTOS[parseInt(pegProd)]
    await guardar({ producto: prod.n, categoria: prod.cat, pventa: prod.p, presentacion: prod.pr,
      piezas: parseInt(pegPiezas), peso: 0, merma: 0, notas: '', ingredientes: ings })
    setPegado(''); setPegProd(''); setPegPiezas(''); setVista('lista')
  }

  const costoReceta = (r) => {
    const ct = r.ingredientes?.reduce((s, i) => s + i.cantidad * i.precio, 0) || 0
    const cu = r.piezas > 0 ? ct / r.piezas : 0
    const margen = r.pventa > 0 ? ((r.pventa - cu) / r.pventa) * 100 : null
    return { ct, cu, margen }
  }

  if (loading) return <div className="text-sm text-gray-400 p-4">Cargando recetas...</div>

  return (
    <div className="max-w-4xl">
      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {[['lista','Mis recetas'],['nueva','Nueva'],['pegar','Pegar tabla']].map(([v, l]) => (
          <button key={v} onClick={() => setVista(v)}
            className={`px-4 py-1.5 text-sm rounded-lg transition-all ${vista === v ? 'bg-white font-medium shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* LISTA */}
      {vista === 'lista' && (
        <div>
          <div className="flex gap-3 mb-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="pl-8" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar receta..." />
            </div>
            <button onClick={() => setVista('nueva')} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> Nueva receta
            </button>
          </div>

          {lista.length === 0 ? (
            <div className="card text-center py-12">
              <ChefHat size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 mb-4">
                {busqueda ? `Sin resultados para "${busqueda}"` : 'Aún no tienes recetas guardadas.'}
              </p>
              <button onClick={() => setVista('nueva')} className="btn-primary inline-flex items-center gap-2">
                <Plus size={14} /> Crear primera receta
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {lista.map(r => {
                const { cu, margen } = costoReceta(r)
                const color = CAT_COLORS[r.categoria] || { bg: '#F1EFE8', text: '#444441' }
                const sel = detalle === r.producto
                return (
                  <div key={r.producto}>
                    <div
                      className={`card cursor-pointer hover:border-amber-300 transition-all ${sel ? 'border-brand-400' : ''}`}
                      onClick={() => setDetalle(sel ? null : r.producto)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-900">{r.producto}</span>
                          <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                            style={{ background: color.bg, color: color.text }}>{r.categoria}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {margen !== null && (
                            <span className={margen >= 57 ? 'badge-ok' : margen >= 35 ? 'badge-warn' : 'badge-bad'}>
                              {margen.toFixed(1)}%
                            </span>
                          )}
                          <span className="badge-info">{r.ingredientes?.length || 0} ing.</span>
                          <button onClick={e => { e.stopPropagation(); handleEditar(r) }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleEliminar(r.producto) }}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-gray-400">
                        <span>{r.piezas} piezas</span>
                        {r.peso > 0 && <span>{r.peso}g/pieza</span>}
                        <span>C$ {r.pventa}</span>
                        {cu > 0 && <span className="text-amber-700 font-medium">Costo unit: C$ {cu.toFixed(2)}</span>}
                      </div>
                    </div>
                    {sel && (
                      <div className="card border-t-0 rounded-t-none bg-gray-50">
                        <div className="overflow-x-auto">
                          <table className="table-base">
                            <thead>
                              <tr><th>Ingrediente</th><th>Cantidad</th><th>Unidad</th><th className="text-right">C$/u</th><th className="text-right">Subtotal</th><th>Tipo</th></tr>
                            </thead>
                            <tbody>
                              {r.ingredientes?.map((ing, i) => (
                                <tr key={i}>
                                  <td>{ing.nombre}</td>
                                  <td>{ing.cantidad}</td>
                                  <td>{ing.unidad}</td>
                                  <td className="text-right">C$ {(ing.precio || 0).toFixed(2)}</td>
                                  <td className="text-right">C$ {(ing.cantidad * ing.precio).toFixed(2)}</td>
                                  <td><span className={ing.tipo === 'indirecto' ? 'badge-info' : 'badge-gray'}>{ing.tipo}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => handleEditar(r)} className="btn-secondary flex items-center gap-1 text-xs">
                            <Edit2 size={12} /> Editar
                          </button>
                          <button onClick={() => {}} className="btn-primary flex items-center gap-1 text-xs">
                            <Calculator size={12} /> Costear ahora
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* NUEVA / EDITAR */}
      {(vista === 'nueva' || vista === 'editar') && (
        <FormReceta
          inicial={editando}
          onGuardar={handleGuardar}
          onCancelar={() => { setVista('lista'); setEditando(null) }}
        />
      )}

      {/* PEGAR TABLA */}
      {vista === 'pegar' && (
        <div className="card max-w-2xl">
          <h3 className="text-sm font-medium text-gray-700 mb-1">Pegar receta desde Excel</h3>
          <p className="text-xs text-gray-400 mb-3">Copia celdas de Excel. Columnas: Ingrediente | Cantidad | Unidad | Precio C$/u</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="form-group">
              <label className="form-label">Producto</label>
              <select value={pegProd} onChange={e => setPegProd(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {PRODUCTOS.map((p, i) => <option key={i} value={i}>{p.n}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Piezas que rinde</label>
              <input type="number" value={pegPiezas} onChange={e => setPegPiezas(e.target.value)} placeholder="100" />
            </div>
          </div>
          <div className="form-group mb-3">
            <label className="form-label">Pegar tabla aquí</label>
            <textarea rows={8} value={pegado} onChange={e => setPegado(e.target.value)}
              placeholder={"Harina\t0.5\tkg\t28\nAzúcar\t0.2\tkg\t18\nHuevos\t3\tunidad\t5\nGas (indirecto)\t1\tporción\t15"} />
          </div>
          <div className="flex gap-2">
            <button onClick={importarPegado} className="btn-primary flex items-center gap-2">
              <Upload size={14} /> Importar tabla
            </button>
            <button onClick={() => setPegado('')} className="btn-secondary">Limpiar</button>
          </div>
        </div>
      )}
    </div>
  )
}
