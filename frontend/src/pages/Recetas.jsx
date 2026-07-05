import { useState, useEffect } from 'react'
import { useRecetas } from '../hooks/useRecetas'
import { getCatalogo, getInventario } from '../lib/api'
import { Plus, Trash2, Edit2, Search, X, Save, ChefHat, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { convertirUnidad } from '../lib/costeo'

export default function Recetas() {
  const { recetas, loading, error, guardar, eliminar, calcularCostos } = useRecetas()
  const [productos, setProductos] = useState([])
  const [insumos, setInsumos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(false)

  // Estado del formulario de receta
  const [formId, setFormId] = useState(null)
  const [formProducto, setFormProducto] = useState('')
  const [formPiezas, setFormPiezas] = useState(100)
  const [formMerma, setFormMerma] = useState(0)
  const [formNotas, setFormNotas] = useState('')
  const [formIngredientes, setFormIngredientes] = useState([])

  // Cargar catálogo de productos para el selector
  useEffect(() => {
    getCatalogo()
      .then(({ data }) => setProductos(data))
      .catch(() => {})
    getInventario()
      .then(({ data }) => setInsumos(data))
      .catch(() => {})
  }, [])

  const abrirCreacion = () => {
    setFormId(null)
    setFormProducto('')
    setFormPiezas(100)
    setFormMerma(0)
    setFormNotas('')
    setFormIngredientes([{ nombre: '', cantidad: '', unidad: 'kg', precio: '', tipo: 'directo', unidad_precio: 'kg' }])
    setEditando(true)
  }

  const abrirEdicion = (r) => {
    setFormId(r.id)
    setFormProducto(r.producto)
    setFormPiezas(r.piezas)
    setFormMerma(r.merma_pct || 0)
    setFormNotas(r.notas || '')
    
    let mapeados = r.ingredientes.map(i => ({
      nombre: i.nombre,
      cantidad: i.cantidad,
      unidad: i.unidad,
      precio: i.precio,
      tipo: i.tipo || 'directo',
      unidad_precio: i.unidad_precio || i.unidad
    }))

    const totalHarina = mapeados.reduce((sum, ing) => {
      if ((ing.nombre || '').toLowerCase().includes('harina')) {
        return sum + convertirUnidad(Number(ing.cantidad) || 0, ing.unidad, 'g')
      }
      return sum
    }, 0)

    mapeados = mapeados.map(ing => {
      const esHarina = (ing.nombre || '').toLowerCase().includes('harina')
      if (esHarina) {
        return { ...ing, porcentaje_panadero: 100 }
      } else if (totalHarina > 0) {
        const cantGramos = convertirUnidad(Number(ing.cantidad) || 0, ing.unidad, 'g')
        const pct = (cantGramos / totalHarina) * 100
        return { ...ing, porcentaje_panadero: Number(pct.toFixed(2)) }
      }
      return { ...ing, porcentaje_panadero: '' }
    })

    setFormIngredientes(mapeados)
    setEditando(true)
  }

  const agregarFilaIngrediente = () => {
    setFormIngredientes(prev => [...prev, { nombre: '', cantidad: '', unidad: 'kg', precio: '', tipo: 'directo', unidad_precio: 'kg', porcentaje_panadero: '' }])
  }

  const eliminarFilaIngrediente = (index) => {
    setFormIngredientes(prev => prev.filter((_, i) => i !== index))
  }

  const recalcularGramosYPorcentajes = (ingredientes, indexModificado, campoModificado, nuevoValor) => {
    let copia = ingredientes.map((ing, i) => {
      if (i === indexModificado) {
        let val = nuevoValor
        if (campoModificado === 'cantidad' || campoModificado === 'porcentaje_panadero' || campoModificado === 'precio') {
          val = nuevoValor === '' ? '' : Number(nuevoValor)
        }
        return { ...ing, [campoModificado]: val }
      }
      return { ...ing }
    })

    const calcularHarina = (arr) => arr.reduce((sum, ing) => {
      if ((ing.nombre || '').toLowerCase().includes('harina')) {
        return sum + convertirUnidad(Number(ing.cantidad) || 0, ing.unidad, 'g')
      }
      return sum
    }, 0)

    let totalHarina = calcularHarina(copia)
    const ingMod = copia[indexModificado]
    const esHarina = (ingMod.nombre || '').toLowerCase().includes('harina')

    if (campoModificado === 'cantidad') {
      if (esHarina) {
        totalHarina = calcularHarina(copia)
        copia = copia.map((ing) => {
          const esEsteHarina = (ing.nombre || '').toLowerCase().includes('harina')
          if (!esEsteHarina && totalHarina > 0 && ing.porcentaje_panadero) {
            const cantGramos = (totalHarina * ing.porcentaje_panadero) / 100
            const cantUnidad = convertirUnidad(cantGramos, 'g', ing.unidad)
            return { ...ing, cantidad: Number(cantUnidad.toFixed(4)) }
          }
          return ing
        })
      } else {
        if (totalHarina > 0) {
          const cantGramos = convertirUnidad(Number(ingMod.cantidad) || 0, ingMod.unidad, 'g')
          const pct = (cantGramos / totalHarina) * 100
          ingMod.porcentaje_panadero = Number(pct.toFixed(2))
        }
      }
    } else if (campoModificado === 'porcentaje_panadero') {
      if (!esHarina && totalHarina > 0) {
        const cantGramos = (totalHarina * (Number(ingMod.porcentaje_panadero) || 0)) / 100
        const cantUnidad = convertirUnidad(cantGramos, 'g', ingMod.unidad)
        ingMod.cantidad = Number(cantUnidad.toFixed(4))
      }
    } else if (campoModificado === 'nombre' || campoModificado === 'unidad') {
      totalHarina = calcularHarina(copia)
      copia = copia.map(ing => {
        const esEsteHarina = (ing.nombre || '').toLowerCase().includes('harina')
        if (esEsteHarina) {
          return { ...ing, porcentaje_panadero: 100 }
        } else if (totalHarina > 0 && ing.cantidad) {
          const cantGramos = convertirUnidad(Number(ing.cantidad) || 0, ing.unidad, 'g')
          const pct = (cantGramos / totalHarina) * 100
          return { ...ing, porcentaje_panadero: Number(pct.toFixed(2)) }
        }
        return ing
      })
    }

    copia = copia.map(ing => {
      if ((ing.nombre || '').toLowerCase().includes('harina')) {
        return { ...ing, porcentaje_panadero: 100 }
      }
      return ing
    })

    return copia
  }

  const calcularPrecioPorUnidadReceta = (precioCompra, unidadCompra, unidadReceta) => {
    if (!precioCompra || !unidadCompra || !unidadReceta) return precioCompra
    const cantEnCompra = convertirUnidad(1, unidadReceta, unidadCompra)
    return precioCompra * cantEnCompra
  }

  const handleIngredienteChange = (index, campo, valor) => {
    setFormIngredientes(prev => {
      let copia = [...prev]
      if (campo === 'unidad') {
        const ing = copia[index]
        const matchingInsumo = insumos.find(ins => ins.nombre.toLowerCase() === ing.nombre.toLowerCase())
        if (matchingInsumo) {
          const precioConvertido = calcularPrecioPorUnidadReceta(matchingInsumo.costo_unitario, matchingInsumo.unidad, valor)
          copia = copia.map((item, i) => i === index ? {
            ...item,
            unidad: valor,
            precio: Number(precioConvertido.toFixed(4)),
            unidad_precio: valor
          } : item)
        }
      }
      return recalcularGramosYPorcentajes(copia, index, campo, valor)
    })
  }

  const handleNombreChange = (index, nombre) => {
    const matchingInsumo = insumos.find(ins => ins.nombre.toLowerCase() === nombre.toLowerCase())
    if (matchingInsumo) {
      setFormIngredientes(prev => {
        const unidadReceta = prev[index].unidad || 'kg'
        const precioConvertido = calcularPrecioPorUnidadReceta(matchingInsumo.costo_unitario, matchingInsumo.unidad, unidadReceta)
        const actualizados = prev.map((ing, i) => i === index ? {
          ...ing,
          nombre,
          precio: Number(precioConvertido.toFixed(4)),
          unidad_precio: unidadReceta,
          unidad: unidadReceta
        } : ing)
        return recalcularGramosYPorcentajes(actualizados, index, 'nombre', nombre)
      })
    } else {
      handleIngredienteChange(index, 'nombre', nombre)
    }
  }

  const submitReceta = async (e) => {
    e.preventDefault()

    if (!formProducto) {
      toast.error('Selecciona un producto del catálogo')
      return
    }

    if (formIngredientes.length === 0) {
      toast.error('Agrega al menos un ingrediente')
      return
    }

    const ingredientesValidos = formIngredientes.filter(i => i.nombre && Number(i.cantidad) > 0)
    if (ingredientesValidos.length !== formIngredientes.length) {
      toast.error('Completa los nombres y cantidades mayores a 0 de todos los ingredientes')
      return
    }

    const payload = {
      id: formId,
      producto: formProducto,
      piezas: Number(formPiezas),
      peso_por_pieza: 0,
      merma_pct: Number(formMerma),
      notas: formNotas,
      ingredientes: formIngredientes.map(i => ({
        ...i,
        cantidad: Number(i.cantidad),
        precio: Number(i.precio || 0)
      }))
    }

    await guardar(payload)
    setEditando(false)
  }

  // Calcular el costo total en tiempo real para el formulario
  const calcularCostoTotalForm = () => {
    return formIngredientes.reduce((sum, ing) => {
      const cant = Number(ing.cantidad) || 0
      const prec = Number(ing.precio) || 0
      const cantConvertida = convertirUnidad(cant, ing.unidad, ing.unidad_precio || ing.unidad)
      return sum + (cantConvertida * prec)
    }, 0)
  }

  // Calcular el peso total de harina para porcentaje de panadero
  const pesoTotalHarinaForm = formIngredientes.reduce((sum, ing) => {
    const nombre = (ing.nombre || '').toLowerCase()
    if (nombre.includes('harina')) {
      const cant = Number(ing.cantidad) || 0
      return sum + convertirUnidad(cant, ing.unidad, 'g')
    }
    return sum
  }, 0)

  const obtenerPorcentajePanadero = (ing) => {
    if (pesoTotalHarinaForm <= 0) return '-'
    const cantGramos = convertirUnidad(Number(ing.cantidad) || 0, ing.unidad, 'g')
    const pct = (cantGramos / pesoTotalHarinaForm) * 100
    return `${pct.toFixed(1)}%`
  }

  const esPrecioSospechoso = (ing) => {
    const prec = Number(ing.precio) || 0
    const uni = (ing.unidad_precio || ing.unidad || '').toLowerCase()
    return (uni === 'g' || uni === 'ml') && prec > 1.5
  }

  const listaRecetas = Object.values(recetas).filter(r =>
    r.producto.toLowerCase().includes(busqueda.toLowerCase())
  )

  if (loading) return <div className="p-6 text-center text-gray-500">Cargando recetas...</div>
  if (error) return <div className="p-6 text-center text-red-500">Error al cargar recetas: {error}</div>

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#263D4F' }}>
            <ChefHat className="text-brand-500" style={{ color: '#C29C53' }} /> Gestión de Recetas
          </h1>
          <p className="text-sm text-gray-500">Define los ingredientes y proporciones base para tu producción</p>
        </div>
        {!editando && (
          <button onClick={abrirCreacion} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm rounded-lg" style={{ background: '#C29C53', color: '#fff' }}>
            <Plus size={16} /> Nueva Receta
          </button>
        )}
      </div>

      {editando ? (
        /* VISTA DE EDICIÓN / CREACIÓN */
        <div className="card shadow-lg bg-white border border-gray-100 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6 border-b pb-3">
            <h2 className="text-lg font-semibold" style={{ color: '#263D4F' }}>
              {formId ? `Editar Receta de ${formProducto}` : 'Crear Nueva Receta'}
            </h2>
            <button onClick={() => setEditando(false)} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={submitReceta}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Producto del Catálogo</label>
                {formId ? (
                  <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-gray-500 cursor-not-allowed" value={formProducto} disabled />
                ) : (
                  <select className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-400" value={formProducto} onChange={e => setFormProducto(e.target.value)} required>
                    <option value="">-- Selecciona un Producto --</option>
                    {productos.map(p => (
                      <option key={p.id} value={p.nombre}>{p.nombre} (C$ {p.precio})</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Piezas Base (Rendimiento)</label>
                <input type="number" min="1" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-400" value={formPiezas} onChange={e => setFormPiezas(e.target.value)} required placeholder="Ej. 100" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Merma Estimada (%)</label>
                <input type="number" min="0" max="100" step="0.1" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-400" value={formMerma} onChange={e => setFormMerma(e.target.value)} placeholder="Ej. 5" />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Notas / Procedimiento</label>
              <textarea rows="2" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-400" value={formNotas} onChange={e => setFormNotas(e.target.value)} placeholder="Agrega detalles técnicos sobre la preparación, temperaturas, etc." />
            </div>

            {/* TABLA DE INGREDIENTES */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Ingredientes Requeridos</h3>
                <button type="button" onClick={agregarFilaIngrediente} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                  <Plus size={14} /> Añadir Ingrediente
                </button>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                <table className="min-w-full bg-white divide-y divide-gray-150">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Ingrediente</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Unidad</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">% Panadero</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Precio Compra (C$)</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase w-16">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {formIngredientes.map((ing, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">
                          <input type="text" list="insumos-list" className="w-full border border-gray-200 rounded-lg p-1.5 text-sm" value={ing.nombre} onChange={e => handleNombreChange(idx, e.target.value)} placeholder="Ej. Harina" required />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0.0001" step="0.0001" className="w-full border border-gray-200 rounded-lg p-1.5 text-sm" value={ing.cantidad} onChange={e => handleIngredienteChange(idx, 'cantidad', e.target.value)} placeholder="Cantidad" required />
                        </td>
                        <td className="px-3 py-2">
                          <select className="w-full border border-gray-200 rounded-lg p-1.5 text-sm" value={ing.unidad} onChange={e => handleIngredienteChange(idx, 'unidad', e.target.value)}>
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="lb">lb</option>
                            <option value="oz">oz</option>
                            <option value="lt">lt</option>
                            <option value="ml">ml</option>
                            <option value="unidad">unidad</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            className="w-full border border-gray-200 rounded-lg p-1.5 text-sm"
                            value={ing.porcentaje_panadero || ''}
                            onChange={e => handleIngredienteChange(idx, 'porcentaje_panadero', e.target.value)}
                            placeholder="%"
                            disabled={!(ing.nombre || '').toLowerCase().includes('harina') && pesoTotalHarinaForm <= 0}
                            readOnly={(ing.nombre || '').toLowerCase().includes('harina')}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="relative flex flex-col">
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              className={`w-full border rounded-lg p-1.5 text-sm ${esPrecioSospechoso(ing) ? 'border-amber-400 bg-amber-50 focus:ring-amber-400' : 'border-gray-200'}`}
                              value={ing.precio}
                              onChange={e => handleIngredienteChange(idx, 'precio', e.target.value)}
                              placeholder="Precio"
                            />
                            {(() => {
                              const matchingInsumo = insumos.find(ins => ins.nombre.toLowerCase() === (ing.nombre || '').toLowerCase())
                              if (matchingInsumo) {
                                return (
                                  <span className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">
                                    Comp: C$ {matchingInsumo.costo_unitario} / {matchingInsumo.unidad}
                                  </span>
                                )
                              }
                              return null
                            })()}
                          </div>
                        </td>

                        <td className="px-3 py-2">
                          <select className="w-full border border-gray-200 rounded-lg p-1.5 text-sm" value={ing.tipo} onChange={e => handleIngredienteChange(idx, 'tipo', e.target.value)}>
                            <option value="directo">Directo</option>
                            <option value="indirecto">Indirecto</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button type="button" onClick={() => eliminarFilaIngrediente(idx)} className="text-red-500 hover:text-red-700 transition-colors p-1" disabled={formIngredientes.length <= 1}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <datalist id="insumos-list">
                  {insumos.map((ins, i) => (
                    <option key={i} value={ins.nombre} />
                  ))}
                </datalist>
              </div>

              <div className="flex justify-between items-center mt-4 p-4 bg-gray-50 rounded-xl border">
                <span className="text-sm text-gray-500 font-medium">Costo Total Estimado Insumos:</span>
                <span className="text-lg font-bold" style={{ color: '#C29C53' }}>C$ {calcularCostoTotalForm().toFixed(2)}</span>
              </div>
            </div>

            {/* ACCIONES DEL FORMULARIO */}
            <div className="flex justify-end gap-3 border-t pt-4">
              <button type="button" onClick={() => setEditando(false)} className="btn-secondary px-4 py-2 rounded-lg text-sm">
                Cancelar
              </button>
              <button type="submit" className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-white" style={{ background: '#263D4F' }}>
                <Save size={16} /> Guardar Receta
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* VISTA DE GRID/LISTADO */
        <>
          {/* BUSCADOR */}
          <div className="relative mb-6 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" className="pl-10 w-full rounded-xl border border-gray-300 py-2 text-sm focus:ring-2 focus:ring-yellow-400" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar receta por producto..." />
          </div>

          {listaRecetas.length === 0 ? (
            <div className="card text-center p-12 border border-dashed border-gray-200 rounded-xl bg-white">
              <ChefHat size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium mb-1">No hay recetas definidas</p>
              <p className="text-xs text-gray-400 mb-4">Crea una receta para empezar a realizar análisis de costos y escalados.</p>
              <button onClick={abrirCreacion} className="btn-primary text-xs px-4 py-2 rounded-lg mx-auto" style={{ background: '#C29C53', color: '#fff' }}>
                Crear tu primera receta
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listaRecetas.map(r => {
                const costos = calcularCostos(r.producto)
                return (
                  <div key={r.id} className="card shadow-sm border border-gray-100 bg-white hover:shadow-md transition-shadow rounded-xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#FAEEDA', color: '#8F6A1E' }}>
                          {r.piezas} piezas
                        </span>
                        {r.merma_pct > 0 && (
                          <span className="text-[10px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded-md">
                            -{r.merma_pct}% merma
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-lg text-gray-900 mb-2 leading-tight">{r.producto}</h3>
                      <div className="space-y-1.5 text-xs text-gray-500 mb-4 bg-gray-50 p-2.5 rounded-lg border">
                        <div className="flex justify-between">
                          <span>Ingredientes:</span>
                          <strong className="text-gray-800">{r.ingredientes?.length || 0}</strong>
                        </div>
                        {costos && (
                          <>
                            <div className="flex justify-between">
                              <span>Costo Unitario:</span>
                              <strong className="text-gray-800">C$ {costos.cu.toFixed(2)}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Precio Sugerido (57%):</span>
                              <strong className="text-gray-800" style={{ color: '#C29C53' }}>C$ {costos.pmin.toFixed(2)}</strong>
                            </div>
                          </>
                        )}
                      </div>
                      {r.notas && (
                        <p className="text-xs text-gray-400 italic line-clamp-2 border-t pt-2 mb-4">
                          {r.notas}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-3 border-t mt-auto">
                      <button onClick={() => abrirEdicion(r)} className="flex-1 btn-secondary text-xs py-2 flex items-center justify-center gap-1">
                        <Edit2 size={13} /> Editar
                      </button>
                      <button onClick={() => { if(confirm('¿Eliminar receta?')) eliminar(r.producto) }} className="btn-secondary text-xs py-2 text-red-500 hover:text-red-700 hover:bg-red-50 flex items-center justify-center px-3 border border-gray-200 rounded-lg">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}