import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecetas } from '../hooks/useRecetas'
import { PRODUCTOS, CAT_COLORS } from '../lib/catalogo'
import { ChefHat, Plus, Search, Upload, Edit2, Trash2, Calculator, CheckCircle, AlertTriangle, Settings } from 'lucide-react'
import { getInventario } from '../lib/api'
import { convertirPrecio, convertirCantidad } from '../lib/unidades'
import api from '../lib/api'
import toast from 'react-hot-toast'

const UNIDADES = ['kg', 'g', 'L', 'ml', 'unidad', 'porción']

function IngredienteRow({ ing, onChange, onDelete, inventario = [] }) {
  const [esPersonalizado, setEsPersonalizado] = useState(false)

  const existeEnInventario = inventario.some(inv => (inv.nombre || '').toLowerCase().trim() === (ing.nombre || '').toLowerCase().trim())

  const handleSelectChange = (val) => {
    if (val === '__custom__') {
      setEsPersonalizado(true)
      onChange({ ...ing, nombre: '' })
    } else {
      setEsPersonalizado(false)
      const picked = inventario.find(inv => (inv.nombre || '').toLowerCase().trim() === (val || '').toLowerCase().trim())
      onChange({
        ...ing,
        nombre: val,
        unidad: picked ? picked.unidad : ing.unidad,
        precio: picked ? parseFloat(picked.costo_unitario) || 0 : ing.precio
      })
    }
  }

  const handleUnidadChange = (nuevaUnidad) => {
    const insumoInv = inventario.find(i => (i.nombre || '').toLowerCase().trim() === (ing.nombre || '').toLowerCase().trim())
    let nuevoPrecio = ing.precio
    if (insumoInv) {
      const costoUnit = parseFloat(insumoInv.costo_unitario) || 0
      nuevoPrecio = convertirPrecio(costoUnit, insumoInv.unidad, nuevaUnidad)
    }
    onChange({ ...ing, unidad: nuevaUnidad, precio: nuevoPrecio })
  }

  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1.2fr_auto] gap-2 items-center mb-2">
      {esPersonalizado ? (
        <div className="flex gap-1 items-center">
          <input
            value={ing.nombre} placeholder="Nombre insumo"
            onChange={e => {
              const val = e.target.value
              const matched = inventario.find(inv => (inv.nombre || '').toLowerCase().trim() === (val || '').toLowerCase().trim())
              onChange({
                ...ing,
                nombre: val,
                unidad: matched ? matched.unidad : ing.unidad,
                precio: matched ? parseFloat(matched.costo_unitario) || 0 : ing.precio
              })
            }}
            className={ing.tipo === 'indirecto' ? 'bg-blue-50 flex-1' : 'flex-1'}
          />
          <button 
            type="button" 
            onClick={() => setEsPersonalizado(false)}
            className="text-[9px] text-gray-400 hover:text-gray-600 px-1 py-0.5 border border-gray-250 rounded hover:bg-gray-50 flex-shrink-0"
            title="Usar lista del inventario"
          >
            Lista
          </button>
        </div>
      ) : (
        <select
          value={ing.nombre}
          onChange={e => handleSelectChange(e.target.value)}
          className={ing.tipo === 'indirecto' ? 'bg-blue-55 dark:bg-navy-800' : ''}
        >
          <option value="">— Seleccionar insumo —</option>
          {ing.nombre && !existeEnInventario && (
            <option value={ing.nombre}>
              ⚠️ {ing.nombre} (No en inventario)
            </option>
          )}
          {inventario.map(inv => (
            <option key={inv.nombre} value={inv.nombre}>
              {inv.nombre}
            </option>
          ))}
          <option value="__custom__">+ Escribir a mano...</option>
        </select>
      )}
      <input type="number" value={ing.cantidad} placeholder="0" step="0.001" min="0"
        onChange={e => onChange({ ...ing, cantidad: parseFloat(e.target.value) || 0 })} />
      <select value={ing.unidad} onChange={e => handleUnidadChange(e.target.value)}>
        {UNIDADES.map(u => <option key={u}>{u}</option>)}
      </select>
      
      <div className="flex flex-col gap-1">
        <input type="number" value={ing.precio} placeholder="C$/u" step="0.0001" min="0"
          onChange={e => onChange({ ...ing, precio: parseFloat(e.target.value) || 0 })} />
        {parseFloat(ing.precio) === 0 && (
          <label className="flex items-center gap-1 text-[9px] text-gray-400 cursor-pointer">
            <input 
              type="checkbox" 
              checked={!!ing.costo_cero_intencional}
              onChange={e => onChange({ ...ing, costo_cero_intencional: e.target.checked })} 
            />
            Cero intencional
          </label>
        )}
      </div>

      <button onClick={onDelete} className="btn-danger p-1.5">
        <Trash2 size={13} />
      </button>
    </div>
  )
}

function FormReceta({ inicial, onGuardar, onCancelar, inventario = [], configCosteo = {} }) {
  const prodIdx = PRODUCTOS.findIndex(p => p.n === inicial?.producto)
  const [prodSel, setProdSel] = useState(prodIdx >= 0 ? prodIdx : '')
  const [piezas, setPiezas] = useState(inicial?.piezas || '')
  const [peso, setPeso] = useState(inicial?.peso_por_pieza || inicial?.peso || '')
  const [merma, setMerma] = useState(inicial?.merma_pct || inicial?.merma || '')
  const [notas, setNotas] = useState(inicial?.notas || '')
  
  const [ings, setIngs] = useState(() => {
    if (inicial?.ingredientes) {
      return inicial.ingredientes.map(ing => {
        const insumoInv = inventario.find(i => (i.nombre || '').toLowerCase().trim() === (ing.nombre || '').toLowerCase().trim())
        if (insumoInv) {
          const costoUnit = parseFloat(insumoInv.costo_unitario) || 0
          const precioActualizado = convertirPrecio(costoUnit, insumoInv.unidad, ing.unidad)
          return { ...ing, precio: precioActualizado }
        }
        return ing
      })
    }
    return [
      { nombre: '', cantidad: '', unidad: 'g', precio: '', tipo: 'directo', costo_cero_intencional: false },
      { nombre: '', cantidad: '', unidad: 'g', precio: '', tipo: 'directo', costo_cero_intencional: false },
    ]
  })

  // Autofill precios cuando carga inventario
  useEffect(() => {
    if (inventario && inventario.length > 0 && inicial?.ingredientes) {
      setIngs(prev => prev.map(ing => {
        if (parseFloat(ing.precio) > 0) return ing
        const insumoInv = inventario.find(i => (i.nombre || '').toLowerCase().trim() === (ing.nombre || '').toLowerCase().trim())
        if (insumoInv) {
          const costoUnit = parseFloat(insumoInv.costo_unitario) || 0
          const precioActualizado = convertirPrecio(costoUnit, insumoInv.unidad, ing.unidad)
          return { ...ing, precio: precioActualizado }
        }
        return ing
      }))
    }
  }, [inventario, inicial])

  // Cálculos en tiempo real
  const pz = parseInt(piezas) || 0
  let costoDirecto = 0
  let costoIndirecto = parseFloat(configCosteo.costo_indirecto_gas || 0) + 
                       parseFloat(configCosteo.costo_indirecto_luz || 0) + 
                       parseFloat(configCosteo.costo_indirecto_mano || 0)

  ings.forEach(ing => {
    const q = parseFloat(ing.cantidad) || 0
    const pr = parseFloat(ing.precio) || 0
    const sub = q * pr
    if (ing.tipo === 'indirecto') {
      costoIndirecto += sub
    } else {
      costoDirecto += sub
    }
  })

  const costoTotal = costoDirecto + costoIndirecto
  const mPct = parseFloat(merma) || 0
  const piezasReales = pz * (1 - mPct / 100)
  const costoUnitario = piezasReales > 0 ? costoTotal / piezasReales : 0
  const margen = parseFloat(configCosteo.margen_objetivo || 57.00) / 100
  const precioSugerido = margen < 1 ? costoUnitario / (1 - margen) : costoUnitario

  const addIng = (tipo = 'directo') =>
    setIngs(prev => [...prev, { nombre: '', cantidad: '', unidad: 'g', precio: '', tipo, costo_cero_intencional: false }])

  const updateIng = (i, val) => setIngs(prev => prev.map((x, idx) => idx === i ? val : x))
  const removeIng = (i) => setIngs(prev => prev.filter((_, idx) => idx !== i))

  const handleGuardar = () => {
    if (prodSel === '') { toast.error('Selecciona un producto'); return }
    if (!piezas) { toast.error('Ingresa las piezas que rinde'); return }
    const ingsValidos = ings.filter(i => i.nombre && parseFloat(i.cantidad) > 0)
    if (!ingsValidos.length) { toast.error('Agrega al menos un ingrediente con cantidad'); return }

    // Validación estricta backend-like para precios cero
    for (const ing of ingsValidos) {
      if (parseFloat(ing.precio) === 0 && !ing.costo_cero_intencional) {
        toast.error(`"${ing.nombre}" tiene costo 0. Activa la casilla de costo cero intencional si es correcto.`);
        return
      }
    }

    const prod = PRODUCTOS[parseInt(prodSel)]
    onGuardar({
      producto: prod.n, categoria: prod.cat, pventa: prod.p, presentacion: prod.pr,
      piezas: pz, peso_por_pieza: parseFloat(peso) || 0,
      merma_pct: parseFloat(merma) || 0, notas,
      costo_directo: costoDirecto,
      costo_indirecto: costoIndirecto,
      margen_aplicado: parseFloat(configCosteo.margen_objetivo || 57.00),
      precio_sugerido: precioSugerido,
      ingredientes: ingsValidos.map(i => ({
        ...i, cantidad: parseFloat(i.cantidad), precio: parseFloat(i.precio) || 0
      }))
    })
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Datos de la receta</h3>
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
          <h3 className="text-sm font-semibold text-gray-700">Ingredientes</h3>
          <div className="flex gap-2">
            <button onClick={() => addIng('directo')} className="btn-secondary text-xs px-2 py-1 flex items-center gap-1">
              <Plus size={12} /> Directo
            </button>
            <button onClick={() => addIng('indirecto')} className="btn-secondary text-xs px-2 py-1 flex items-center gap-1" style={{ color: '#185FA5' }}>
              <Plus size={12} /> Indirecto
            </button>
        </div>
      </div>

        {parseFloat(configCosteo.costo_indirecto_gas || 0) + parseFloat(configCosteo.costo_indirecto_luz || 0) + parseFloat(configCosteo.costo_indirecto_mano || 0) > 0 && (
          <div className="bg-blue-50 border border-blue-100 text-blue-800 text-[11px] p-2 rounded-lg mb-3">
            💡 <strong>Costos indirectos fijos activos:</strong> Gas, luz y mano de obra ya están incluidos automáticamente en base a la configuración global. Evita agregarlos de forma manual en la lista para prevenir doble cobro.
          </div>
        )}

        <div className="grid grid-cols-[2fr_1fr_1fr_1.2fr_auto] gap-2 mb-2">
          {['Ingrediente', 'Cantidad', 'Unidad', 'C$/unidad', ''].map((h, i) => (
            <div key={i} className="text-xs text-gray-400 font-medium">{h}</div>
          ))}
        </div>

        {ings.map((ing, i) => (
          <IngredienteRow key={i} ing={ing}
            inventario={inventario}
            onChange={val => updateIng(i, val)}
            onDelete={() => removeIng(i)} />
        ))}

        <div className="flex gap-2 mt-1 text-xs text-gray-400 mb-3">
          <span className="badge-gray">Directo</span> ingredientes físicos &nbsp;
          <span className="badge-info">Indirecto</span> gas, energía, mano de obra
        </div>
      </div>

      {/* Desglose matemático en tiempo real */}
      <div className="card bg-gray-50 border border-gray-200">
        <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Costeo Estimado en Tiempo Real</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="text-gray-400">Costo Directo</div>
            <div className="font-semibold text-gray-800">C$ {costoDirecto.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-400">Costo Indirecto</div>
            <div className="font-semibold text-gray-800">C$ {costoIndirecto.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-400">Costo Unitario ({pz} pz)</div>
            <div className="font-bold text-amber-700">C$ {costoUnitario.toFixed(2)} /pz</div>
          </div>
          <div>
            <div className="text-gray-400">Precio Sugerido ({configCosteo.margen_objetivo}% Margen)</div>
            <div className="font-bold text-green-700">C$ {precioSugerido.toFixed(2)} /pz</div>
          </div>
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
  const navigate = useNavigate()
  const { recetas, loading, guardar, eliminar, recargar } = useRecetas()
  const [vista, setVista] = useState('lista') // lista | nueva | editar | pegar
  const [editando, setEditando] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [pegado, setPegado] = useState('')
  const [pegProd, setPegProd] = useState('')
  const [pegPiezas, setPegPiezas] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [inventario, setInventario] = useState([])
  const [configCosteo, setConfigCosteo] = useState({
    costo_indirecto_gas: 0,
    costo_indirecto_luz: 0,
    costo_indirecto_mano: 0,
    margen_objetivo: 57.00
  })
  const [panelConfig, setPanelConfig] = useState(false)

  const cargarInventario = () => {
    getInventario()
      .then(res => { setInventario(res.data || []) })
      .catch(err => { console.error("Error al cargar inventario:", err) })
  }

  const cargarConfig = () => {
    api.get('/recetas/configuracion-costeo/settings')
      .then(res => { setConfigCosteo(res.data) })
      .catch(err => { console.error("Error al cargar config costeo:", err) })
  }

  useEffect(() => {
    cargarInventario()
    cargarConfig()
  }, [])

  const handleGuardarConfig = async () => {
    try {
      await api.put('/recetas/configuracion-costeo/settings', configCosteo)
      toast.success('Configuración de costeo guardada')
      setPanelConfig(false)
    } catch (e) {
      toast.error('No se pudo guardar la configuración')
    }
  }

  const handleGuardar = async (datos) => {
    await guardar(datos)
    recargar()
    setVista('lista')
    setEditando(null)
  }

  const handleEditar = (receta) => {
    setEditando(receta)
    setVista('editar')
  }

  const handleEliminar = async (nombre) => {
    if (confirm(`¿Eliminar receta de "${nombre}"?`)) {
      await eliminar(nombre)
      recargar()
    }
  }

  const importarPegado = async () => {
    if (!pegProd || !pegPiezas) { toast.error('Selecciona producto y piezas'); return }
    const lineas = pegado.trim().split('\n').filter(Boolean)
    const ings = []
    
    const cleanNumStr = (str) => {
      if (!str) return '0'
      return str.replace(/[^0-9.,-]/g, '').replace(',', '.')
    }

    lineas.forEach(l => {
      let cols = []
      if (l.includes('\t')) cols = l.split('\t')
      else if (l.includes(';')) cols = l.split(';')
      else cols = l.split(',')
      cols = cols.map(c => c.trim())

      if (cols.length >= 2) {
        const nombre = cols[0]
        const cantidad = parseFloat(cleanNumStr(cols[1])) || 0
        const unidad = cols[2] || 'g'
        
        const insumoInv = inventario.find(i => i.nombre.toLowerCase().trim() === nombre.toLowerCase().trim())
        let precio = 0
        if (insumoInv) {
          const costoUnit = parseFloat(insumoInv.costo_unitario) || 0
          precio = convertirPrecio(costoUnit, insumoInv.unidad, unidad)
        } else if (cols[3]) {
          precio = parseFloat(cleanNumStr(cols[3])) || 0
        }

        if (nombre && cantidad > 0) {
          ings.push({
            nombre,
            cantidad,
            unidad,
            precio,
            tipo: nombre.toLowerCase().includes('indirecto') ? 'indirecto' : 'directo',
            costo_cero_intencional: false
          })
        }
      }
    })

    if (!ings.length) { toast.error('No se encontraron ingredientes válidos'); return }
    const prod = PRODUCTOS[parseInt(pegProd)]
    
    // Calcular estimaciones simples para el importador
    const pz = parseInt(pegPiezas) || 100
    let cd = 0
    ings.forEach(i => { cd += i.cantidad * i.precio })

    await guardar({ 
      producto: prod.n, categoria: prod.cat, pventa: prod.p, presentacion: prod.pr,
      piezas: pz, peso_por_pieza: 0, merma_pct: 0, notas: '', 
      costo_directo: cd, costo_indirecto: 0, margen_aplicado: configCosteo.margen_objetivo, precio_sugerido: cd / pz,
      ingredientes: ings 
    })
    setPegado(''); setPegProd(''); setPegPiezas(''); setVista('lista')
    recargar()
  }

  const lista = Object.values(recetas).filter(r =>
    !busqueda || r.producto.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="max-w-4xl">
      <div className="flex justify-between items-center mb-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {[['lista','Mis recetas'],['nueva','Nueva'],['pegar','Pegar tabla']].map(([v, l]) => (
            <button key={v} onClick={() => setVista(v)}
              className={`px-4 py-1.5 text-sm rounded-lg transition-all ${vista === v ? 'bg-white font-medium shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>
        
        {vista === 'lista' && (
          <button onClick={() => setPanelConfig(p => !p)} className="btn-secondary flex items-center gap-1.5 text-xs">
            <Settings size={13} /> Ajustar Costos Globales
          </button>
        )}
      </div>

      {panelConfig && (
        <div className="card mb-4 bg-gray-50 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">Configuración General de Costeos</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-xs">
            <div className="form-group">
              <label className="form-label">Costo Gas indirecto (C$)</label>
              <input type="number" value={configCosteo.costo_indirecto_gas} 
                onChange={e => setConfigCosteo(p => ({ ...p, costo_indirecto_gas: e.target.value }))} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Costo Luz/Agua indirecto (C$)</label>
              <input type="number" value={configCosteo.costo_indirecto_luz} 
                onChange={e => setConfigCosteo(p => ({ ...p, costo_indirecto_luz: e.target.value }))} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Costo Mano de Obra (C$)</label>
              <input type="number" value={configCosteo.costo_indirecto_mano} 
                onChange={e => setConfigCosteo(p => ({ ...p, costo_indirecto_mano: e.target.value }))} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Margen de Utilidad Objetivo (%)</label>
              <input type="number" value={configCosteo.margen_objetivo} 
                onChange={e => setConfigCosteo(p => ({ ...p, margen_objetivo: e.target.value }))} placeholder="57" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleGuardarConfig} className="btn-primary text-xs">Guardar Configuración</button>
            <button onClick={() => setPanelConfig(false)} className="btn-secondary text-xs">Cerrar</button>
          </div>
        </div>
      )}

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
                const color = CAT_COLORS[r.categoria] || { bg: '#F1EFE8', text: '#444441' }
                const sel = detalle === r.producto
                
                // Usar snapshot guardado si existe, de lo contrario fallback a cálculo al vuelo
                const cd = parseFloat(r.costo_directo || 0)
                const ci = parseFloat(r.costo_indirecto || 0)
                const ct = cd + ci
                const mPct = parseFloat(r.merma_pct || r.merma || 0)
                const piezasReales = r.piezas * (1 - mPct / 100)
                const cu = piezasReales > 0 ? ct / piezasReales : 0
                const margen = r.pventa > 0 ? ((r.pventa - cu) / r.pventa) * 100 : null

                return (
                  <div key={r.producto}>
                    <div
                      className={`card cursor-pointer hover:border-amber-300 transition-all ${sel ? 'border-brand-400 bg-amber-50/10' : ''}`}
                      onClick={() => setDetalle(sel ? null : r.producto)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900">{r.producto}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                            style={{ background: color.bg, color: color.text }}>{r.categoria}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {margen !== null && (
                            <span className={margen >= 57 ? 'badge-ok' : margen >= 35 ? 'badge-warn' : 'badge-bad'}>
                              {margen.toFixed(1)}% Margen
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
                        {(r.peso_por_pieza > 0 || r.peso > 0) && <span>{r.peso_por_pieza || r.peso}g/pieza</span>}
                        <span>Precio Venta: C$ {parseFloat(r.pventa || 0).toFixed(2)}</span>
                        {cu > 0 && <span className="text-amber-700 font-medium">Costo unit: C$ {cu.toFixed(2)}</span>}
                      </div>
                    </div>
                    {sel && (
                      <div className="card border-t-0 rounded-t-none bg-gray-50">
                        <div className="overflow-x-auto">
                          <table className="table-base text-xs">
                            <thead>
                              <tr><th>Ingrediente</th><th>Cantidad</th><th>Unidad</th><th className="text-right">C$/u</th><th className="text-right">Subtotal</th><th>Tipo</th></tr>
                            </thead>
                            <tbody>
                              {r.ingredientes?.map((ing, i) => {
                                const q = parseFloat(ing.cantidad) || 0
                                const p = parseFloat(ing.precio) || 0
                                return (
                                  <tr key={i} className="border-b border-gray-100 last:border-0">
                                    <td className="py-1 font-medium text-gray-700">{ing.nombre}</td>
                                    <td>{q}</td>
                                    <td>{ing.unidad}</td>
                                    <td className="text-right">C$ {p.toFixed(2)}</td>
                                    <td className="text-right font-medium">C$ {(q * p).toFixed(2)}</td>
                                    <td>
                                      <span className={ing.tipo === 'indirecto' ? 'badge-info' : 'badge-gray'}>
                                        {ing.tipo}
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-gray-200 pt-3 text-xs mb-3 text-gray-600">
                          <div><span className="text-gray-400">Costo Directo:</span> C$ {cd.toFixed(2)}</div>
                          <div><span className="text-gray-400">Costo Indirecto:</span> C$ {ci.toFixed(2)}</div>
                          <div><span className="text-gray-400">Costo Unitario:</span> C$ {cu.toFixed(2)}</div>
                          <div><span className="text-gray-400">Precio Sugerido:</span> C$ {parseFloat(r.precio_sugerido || cu).toFixed(2)}</div>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => handleEditar(r)} className="btn-secondary flex items-center gap-1 text-xs">
                            <Edit2 size={12} /> Editar
                          </button>
                          <button onClick={() => navigate('/costeo', { state: { producto: r.producto } })} className="btn-primary flex items-center gap-1 text-xs">
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
          inventario={inventario}
          configCosteo={configCosteo}
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
