import { useState, useEffect } from 'react'
import {
  getUsuarios, saveUsuario, resetUsuarioPassword, deleteUsuario
} from '../lib/api'
import { Users, UserPlus, Key, Trash2, Shield, Eye, EyeOff, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Equipo() {
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

  useEffect(() => {
    cargarEquipo()
  }, [])

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

  return (
    <div className="max-w-4xl space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        
        {/* Registrar Colaborador */}
        <div className="md:col-span-1 space-y-6">
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

          {/* Restablecer Contraseña (Modo Edición Rápida) */}
          {resetUserId && (
            <div className="card border border-[#C29C53]/40 bg-[#FBF6EC] dark:bg-navy-900/40">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Key size={15} className="text-[#C29C53]" /> Restablecer Contraseña
                </span>
                <button onClick={() => setResetUserId(null)} className="text-gray-450 hover:text-red-500">
                  <X size={15} />
                </button>
              </h3>
              
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
                    <tr key={user.id}>
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
                          <button
                            onClick={() => {
                              setResetUserId(user.id)
                              setNuevoPassword('')
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
    </div>
  )
}
