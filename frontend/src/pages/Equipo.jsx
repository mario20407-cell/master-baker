import { useState, useEffect } from 'react'
import {
  getUsuarios, saveUsuario, updateUsuario, resetUsuarioPassword, deleteUsuario, getBitacora
} from '../lib/api'
import {
  Users, UserPlus, Key, Trash2, Shield, Eye, EyeOff, Check, X,
  Activity, ClipboardList, ShieldAlert, Clock, Info, ChevronDown, ChevronUp
} from 'lucide-react'
import toast from 'react-hot-toast'

const PERMISOS_DISPONIBLES = [
  { id: 'ver_recetas', label: 'Ver Recetas', modulo: 'Recetas' },
  { id: 'editar_recetas', label: 'Crear/Editar Recetas', modulo: 'Recetas' },
  { id: 'ver_costeo', label: 'Ver Costeo & Márgenes', modulo: 'Costeo' },
  { id: 'editar_costeo', label: 'Modificar Márgenes', modulo: 'Costeo' },
  { id: 'ver_inventario', label: 'Ver Inventario', modulo: 'Inventario' },
  { id: 'editar_inventario', label: 'Modificar Stock/Insumos', modulo: 'Inventario' },
  { id: 'ver_compras', label: 'Ver Facturas de Compras', modulo: 'Compras' },
  { id: 'registrar_compras', label: 'Registrar Facturas', modulo: 'Compras' },
  { id: 'ver_ventas', label: 'Ver Historial de Ventas', modulo: 'Ventas' },
  { id: 'registrar_ventas', label: 'Registrar Ventas en Caja', modulo: 'Ventas' },
  { id: 'eliminar_ventas', label: 'Anular/Eliminar Ventas', modulo: 'Ventas' },
  { id: 'ver_produccion', label: 'Ver Órdenes de Producción', modulo: 'Producción' },
  { id: 'gestionar_produccion', label: 'Crear/Completar Órdenes', modulo: 'Producción' },
  { id: 'ver_catalogo', label: 'Ver Catálogo', modulo: 'Catálogo' },
  { id: 'editar_catalogo', label: 'Editar Productos/Precios', modulo: 'Catálogo' },
]

export default function Equipo() {
  const [activeTab, setActiveTab] = useState('colaboradores')
  const [colaboradores, setColaboradores] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Registrar nuevo colaborador form
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'operario' })
  const [showPass, setShowPass] = useState(false)
  const [creando, setCreando] = useState(false)

  // Restablecer contraseña form
  const [resetUserId, setResetUserId] = useState(null)
  const [nuevoPassword, setNuevoPassword] = useState('')
  const [showNewPass, setShowNewPass] = useState(false)
  const [guardandoPass, setGuardandoPass] = useState(false)

  // Permisos Modal / Drawer
  const [editPermisosUser, setEditPermisosUser] = useState(null)
  const [selectedPermisos, setSelectedPermisos] = useState([])
  const [guardandoPermisos, setGuardandoPermisos] = useState(false)

  // Bitácora de Actividades
  const [bitacora, setBitacora] = useState([])
  const [loadingBitacora, setLoadingBitacora] = useState(false)
  const [collapsedLogs, setCollapsedLogs] = useState({})

  const cargarEquipo = async () => {
    setLoading(true)
    try {
      const { data } = await getUsuarios()
      setColaboradores(data)
    } catch (e) {
      toast.error('No se pudo cargar la lista de colaboradores')
    } finally {
      setLoading(false)
    }
  }

  const cargarBitacora = async () => {
    setLoadingBitacora(true)
    try {
      const { data } = await getBitacora(150)
      setBitacora(data)
    } catch (e) {
      toast.error('No se pudo cargar la bitácora de actividades')
    } finally {
      setLoadingBitacora(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'colaboradores') {
      cargarEquipo()
    } else {
      cargarBitacora()
    }
  }, [activeTab])

  const handleCrearColaborador = async (e) => {
    e.preventDefault()
    if (!form.nombre || !form.email || !form.password) {
      toast.error('Todos los campos son obligatorios')
      return
    }
    if (form.password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setCreando(true)
    try {
      await saveUsuario(form)
      toast.success('Colaborador registrado exitosamente')
      setForm({ nombre: '', email: '', password: '', rol: 'operario' })
      cargarEquipo()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al registrar colaborador')
    } finally {
      setCreando(false)
    }
  }

  const handleRestablecerPassword = async (e) => {
    e.preventDefault()
    if (!nuevoPassword || nuevoPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setGuardandoPass(true)
    try {
      await resetUsuarioPassword(resetUserId, nuevoPassword)
      toast.success('Contraseña restablecida correctamente')
      setResetUserId(null)
      setNuevoPassword('')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al restablecer la contraseña')
    } finally {
      setGuardandoPass(false)
    }
  }

  const handleEliminar = async (id, nombre) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar a "${nombre}" del equipo?`)) return
    try {
      await deleteUsuario(id)
      toast.success('Colaborador eliminado')
      cargarEquipo()
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo eliminar el colaborador')
    }
  }

  const handleAbrirPermisos = (user) => {
    setEditPermisosUser(user)
    setSelectedPermisos(user.permisos || [])
  }

  const handleTogglePermiso = (permisoId) => {
    if (selectedPermisos.includes(permisoId)) {
      setSelectedPermisos(prev => prev.filter(p => p !== permisoId))
    } else {
      setSelectedPermisos(prev => [...prev, permisoId])
    }
  }

  const handleGuardarPermisos = async (e) => {
    e.preventDefault()
    setGuardandoPermisos(true)
    try {
      await updateUsuario(editPermisosUser.id, {
        nombre: editPermisosUser.nombre,
        rol: editPermisosUser.rol,
        permisos: selectedPermisos
      })
      toast.success('Permisos actualizados correctamente')
      setEditPermisosUser(null)
      cargarEquipo()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al actualizar permisos')
    } finally {
      setGuardandoPermisos(false)
    }
  }

  const toggleCollapseLog = (id) => {
    setCollapsedLogs(p => ({ ...p, [id]: !p[id] }))
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Selector de Pestañas */}
      <div className="flex border-b border-gray-200 dark:border-navy-800">
        <button
          onClick={() => setActiveTab('colaboradores')}
          className={`py-3 px-6 font-medium text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'colaboradores'
              ? 'border-[#C29C53] text-[#C29C53]'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Users size={16} /> Colaboradores & Equipo
        </button>
        <button
          onClick={() => setActiveTab('bitacora')}
          className={`py-3 px-6 font-medium text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'bitacora'
              ? 'border-[#C29C53] text-[#C29C53]'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Activity size={16} /> Bitácora de Actividades (Auditoría)
        </button>
      </div>

      {activeTab === 'colaboradores' ? (
        <div className="grid md:grid-cols-3 gap-6">
          
          {/* Registrar Colaborador / Restablecer Password / Modificar Permisos */}
          <div className="md:col-span-1 space-y-6">
            
            {/* Formulario Permisos */}
            {editPermisosUser ? (
              <div className="card border border-[#C29C53]/40 bg-[#FBF6EC]/30 dark:bg-navy-900/40">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    <Shield size={16} className="text-[#C29C53]" /> Permisos: {editPermisosUser.nombre}
                  </h3>
                  <button onClick={() => setEditPermisosUser(null)} className="text-gray-450 hover:text-red-500">
                    <X size={16} />
                  </button>
                </div>
                
                <form onSubmit={handleGuardarPermisos} className="space-y-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Activa o desactiva las secciones a las que este operario tendrá acceso en la aplicación.
                  </p>

                  <div className="max-h-[350px] overflow-y-auto pr-2 space-y-3 divide-y divide-gray-100 dark:divide-navy-800">
                    {/* Agrupados por módulo */}
                    {Array.from(new Set(PERMISOS_DISPONIBLES.map(p => p.modulo))).map(mod => (
                      <div key={mod} className="pt-2 first:pt-0">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-550 block mb-1">
                          {mod}
                        </span>
                        <div className="space-y-1.5">
                          {PERMISOS_DISPONIBLES.filter(p => p.modulo === mod).map(perm => (
                            <label key={perm.id} className="flex items-start gap-2.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-white">
                              <input
                                type="checkbox"
                                checked={selectedPermisos.includes(perm.id)}
                                onChange={() => handleTogglePermiso(perm.id)}
                                className="mt-0.5 rounded text-[#C29C53] focus:ring-[#C29C53]"
                              />
                              <span>{perm.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={guardandoPermisos}
                      className="btn-primary flex-1 py-1.5 text-xs flex justify-center items-center gap-1"
                    >
                      <Check size={12} /> {guardandoPermisos ? 'Guardando...' : 'Guardar Permisos'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPermisosUser(null)}
                      className="btn-secondary py-1.5 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            ) : resetUserId ? (
              /* Restablecer Contraseña */
              <div className="card border border-[#C29C53]/40 bg-[#FBF6EC]/30 dark:bg-navy-900/40">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    <Key size={15} className="text-[#C29C53]" /> Restablecer Contraseña
                  </h3>
                  <button onClick={() => setResetUserId(null)} className="text-gray-450 hover:text-red-500">
                    <X size={15} />
                  </button>
                </div>
                
                <form onSubmit={handleRestablecerPassword} className="space-y-3">
                  <div className="form-group">
                    <label className="form-label text-xs">Nueva Contraseña</label>
                    <div className="relative">
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        value={nuevoPassword}
                        onChange={e => setNuevoPassword(e.target.value)}
                        placeholder="Min. 8 caracteres"
                        className="pr-10 text-xs py-1.5"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                      >
                        {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={guardandoPass}
                      className="btn-primary flex-1 py-1.5 text-xs flex justify-center items-center gap-1"
                    >
                      <Check size={12} /> {guardandoPass ? 'Guardando...' : 'Restablecer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetUserId(null)}
                      className="btn-secondary py-1.5 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Registrar Colaborador */
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                  <UserPlus size={16} className="text-[#C29C53]" /> Registrar Colaborador
                </h3>
                
                <form onSubmit={handleCrearColaborador} className="space-y-4">
                  <div className="form-group">
                    <label className="form-label">Nombre Completo</label>
                    <input
                      type="text"
                      value={form.nombre}
                      onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                      placeholder="Ej. María López"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Correo Electrónico</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="maria@correo.com"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Contraseña Temporal</label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={form.password}
                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                        placeholder="Min. 8 caracteres"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650"
                      >
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Rol en la Panadería</label>
                    <select
                      value={form.rol}
                      onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}
                    >
                      <option value="operario">Operario (Panadero / Cajero)</option>
                      <option value="admin">Administrador (Acceso total)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={creando}
                    className="btn-primary w-full py-2 flex items-center justify-center gap-2"
                  >
                    {creando ? 'Registrando...' : 'Registrar'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Listado de Equipo */}
          <div className="md:col-span-2 card">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Users size={16} className="text-[#C29C53]" /> Colaboradores de tu Panadería
            </h3>

            {loading ? (
              <div className="text-sm text-gray-400 py-6 text-center">Cargando equipo...</div>
            ) : colaboradores.length === 0 ? (
              <div className="text-sm text-gray-400 py-6 text-center">No hay otros colaboradores registrados.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th>Rol</th>
                      <th>Último Acceso</th>
                      <th className="text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {colaboradores.map(user => (
                      <tr key={user.id} className={editPermisosUser?.id === user.id ? 'bg-[#C29C53]/5' : ''}>
                        <td className="font-medium text-gray-800 dark:text-gray-250">{user.nombre}</td>
                        <td className="text-gray-500 dark:text-gray-400 text-xs">{user.email}</td>
                        <td>
                          <span className={`badge-gray inline-flex items-center gap-1 text-[10px] ${user.rol === 'admin' ? 'border border-[#C29C53]/35 text-[#8B6914] dark:text-[#C29C53] bg-[#8B6914]/5' : ''}`}>
                            {user.rol === 'admin' && <Shield size={10} />}
                            {user.rol === 'admin' ? 'Administrador' : 'Operario'}
                          </span>
                        </td>
                        <td className="text-gray-400 text-[11px]">
                          {user.ultimo_login 
                            ? new Date(user.ultimo_login).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' })
                            : 'Nunca'
                          }
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {user.rol === 'operario' && (
                              <button
                                onClick={() => handleAbrirPermisos(user)}
                                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-navy-800 text-gray-450 hover:text-[#C29C53] transition-colors"
                                title="Configurar Permisos del Operario"
                              >
                                <Shield size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setResetUserId(user.id)
                                setNuevoPassword('')
                                setEditPermisosUser(null)
                              }}
                              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-navy-800 text-gray-450 hover:text-[#C29C53] transition-colors"
                              title="Restablecer Contraseña"
                            >
                              <Key size={14} />
                            </button>
                            <button
                              onClick={() => handleEliminar(user.id, user.nombre)}
                              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/20 text-gray-440 hover:text-red-500 transition-colors"
                              title="Eliminar del Equipo"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      ) : (
        /* PESTAÑA: Bitácora de Actividades (Auditoría) */
        <div className="card space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <ClipboardList size={16} className="text-[#C29C53]" /> Historial de Actividad Reciente
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Registro cronológico de quién ha hecho qué, cuándo y desde dónde en el sistema.
              </p>
            </div>
            <button
              onClick={cargarBitacora}
              className="btn-secondary py-1 px-3 text-xs flex items-center gap-1.5"
            >
              Actualizar Bitácora
            </button>
          </div>

          {loadingBitacora ? (
            <div className="text-center py-10 text-sm text-gray-400">Cargando registros de auditoría...</div>
          ) : bitacora.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">No se registran actividades recientes en la plataforma.</div>
          ) : (
            <div className="relative border-l border-gray-250 dark:border-navy-800 ml-4 space-y-6 py-2">
              {bitacora.map((log) => {
                const isCollapsed = collapsedLogs[log.id] ?? true
                const dateObj = new Date(log.creado_en)
                
                // Mapear color e icono según el módulo
                let badgeColor = 'bg-gray-100 text-gray-800 border-gray-200'
                if (log.modulo === 'ventas') badgeColor = 'bg-green-50 text-green-755 border-green-200 dark:bg-green-950/15 dark:text-green-400 dark:border-green-900/40'
                if (log.modulo === 'inventario') badgeColor = 'bg-orange-50 text-orange-755 border-orange-200 dark:bg-orange-950/15 dark:text-orange-400 dark:border-orange-900/40'
                if (log.modulo === 'recetas') badgeColor = 'bg-purple-50 text-purple-755 border-purple-200 dark:bg-purple-950/15 dark:text-purple-400 dark:border-purple-900/40'
                if (log.modulo === 'catalogo') badgeColor = 'bg-blue-50 text-blue-755 border-blue-200 dark:bg-blue-950/15 dark:text-blue-400 dark:border-blue-900/40'
                if (log.modulo === 'compras') badgeColor = 'bg-amber-50 text-amber-755 border-amber-200 dark:bg-amber-950/15 dark:text-amber-400 dark:border-amber-900/40'

                return (
                  <div key={log.id} className="relative pl-6">
                    {/* Punto indicador */}
                    <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-[#C29C53] border-2 border-white dark:border-navy-950"></div>
                    
                    <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                            {log.usuario_nombre}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            ({log.usuario_email})
                          </span>
                          <span className={`text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border font-semibold ${badgeColor}`}>
                            {log.modulo}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                          {log.descripcion}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-center">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1" title={dateObj.toString()}>
                          <Clock size={10} />
                          {dateObj.toLocaleDateString('es-NI', { month: 'short', day: 'numeric' })} a las {dateObj.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        
                        {log.ip_origen && (
                          <span className="text-[10px] bg-gray-100 dark:bg-navy-900 text-gray-500 font-mono px-1 rounded">
                            {log.ip_origen}
                          </span>
                        )}

                        {log.detalles && Object.keys(log.detalles).length > 0 && (
                          <button
                            onClick={() => toggleCollapseLog(log.id)}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-navy-800 text-gray-450 hover:text-gray-700 dark:hover:text-gray-200"
                            title="Ver detalles JSON"
                          >
                            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Detalles JSON desplegables */}
                    {!isCollapsed && log.detalles && (
                      <div className="mt-2 p-3 bg-gray-50 dark:bg-navy-900 border border-gray-150 dark:border-navy-800 rounded-md text-[10px] font-mono text-gray-600 dark:text-gray-300 overflow-x-auto leading-relaxed">
                        <div className="flex items-center gap-1.5 text-gray-400 mb-1 border-b border-gray-200 dark:border-navy-800 pb-1">
                          <Info size={10} /> Detalle Técnico de la Operación:
                        </div>
                        <pre>{JSON.stringify(log.detalles, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
