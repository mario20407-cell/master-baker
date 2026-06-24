// pages/Usuarios.jsx — v3.0 Panel de gestión de usuarios (solo admin)
import { useState, useEffect } from 'react'
import { Users, Plus, UserCheck, UserX, Mail, Shield, Clock, Eye, EyeOff } from 'lucide-react'
import { getUsuarios, registrarUsuario, toggleUsuario } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const fmtFecha = f => f ? new Date(f).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca'

export default function Usuarios() {
  const { usuario: yo } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'operario' })
  const [guardando, setGuardando] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const cargar = async () => {
    try {
      const { data } = await getUsuarios()
      setUsuarios(data.usuarios)
    } catch {
      toast.error('No se pudo cargar la lista de usuarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const handleCrear = async () => {
    if (!form.nombre || !form.email || !form.password) {
      toast.error('Nombre, email y contraseña son requeridos')
      return
    }
    if (form.password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setGuardando(true)
    try {
      await registrarUsuario(form)
      toast.success(`Cuenta de ${form.nombre} creada`)
      setForm({ nombre: '', email: '', password: '', rol: 'operario' })
      setMostrarForm(false)
      setShowPass(false)
      await cargar()
    } catch (e) {
    } finally {
      setGuardando(false)
    }
  }

  const handleToggle = async (u) => {
    const accion = u.activo ? 'desactivar' : 'activar'
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} la cuenta de ${u.nombre}?`)) return
    try {
      await toggleUsuario(u.id, !u.activo)
      toast.success(`Cuenta ${u.activo ? 'desactivada' : 'activada'}`)
      await cargar()
    } catch {
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Users size={15} /> Usuarios del sistema ({usuarios.length})
          </h3>
          <button onClick={() => setMostrarForm(p => !p)} className="btn-primary flex items-center gap-1.5 text-xs">
            <Plus size={13} /> Nueva cuenta
          </button>
        </div>

        {mostrarForm && (
          <div className="rounded-xl p-4 mb-4" style={{ background: '#F8F9FA', border: '1px solid #E5E7EB' }}>
            <h4 className="text-xs font-medium text-gray-700 mb-3">Crear cuenta de operario</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="form-group">
                <label className="form-label">Nombre completo</label>
                <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Juan Perez" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="juan@marquez.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Contrasena (min. 8 caracteres)</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••" className="pr-10 w-full" />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Rol</label>
                <select value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}>
                  <option value="operario">Operario</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCrear} disabled={guardando} className="btn-primary flex items-center gap-1.5 text-xs">
                <Plus size={13} /> {guardando ? 'Creando...' : 'Crear cuenta'}
              </button>
              <button onClick={() => setMostrarForm(false)} className="btn-secondary text-xs">Cancelar</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-400 py-4 text-center">Cargando...</div>
        ) : (
          <div className="space-y-2">
            {usuarios.map(u => (
              <div key={u.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${u.activo ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: u.rol === 'admin' ? '#263D4F' : '#EAF3DE' }}>
                  <span className="text-xs font-bold" style={{ color: u.rol === 'admin' ? '#fff' : '#27500A' }}>
                    {u.nombre.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{u.nombre}</span>
                    {u.id === yo?.id && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#EAF3DE', color: '#27500A' }}>Tu cuenta</span>}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${u.rol === 'admin' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {u.rol}
                    </span>
                    {!u.activo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600">Desactivado</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Mail size={10} /> {u.email}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={10} /> {fmtFecha(u.ultimo_login)}</span>
                  </div>
                </div>
                {u.id !== yo?.id && (
                  <button onClick={() => handleToggle(u)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                      u.activo ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'
                    }`}>
                    {u.activo ? <><UserX size={12} /> Desactivar</> : <><UserCheck size={12} /> Activar</>}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl p-3" style={{ background: '#F8F9FA', border: '1px solid #E5E7EB' }}>
        <div className="flex items-start gap-2">
          <Shield size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-500">
            Los operarios pueden registrar ventas, consultar inventario y usar la IA, pero no pueden editar precios, recetas ni configuracion fiscal.
            Al desactivar una cuenta el usuario no puede iniciar sesión, pero sus registros se conservan.
          </p>
        </div>
      </div>
    </div>
  )
}