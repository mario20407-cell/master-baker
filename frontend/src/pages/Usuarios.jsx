import { useState, useEffect } from 'react'
import api, { API } from '../lib/api'
import toast from 'react-hot-toast'

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'operario' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [waConfig, setWaConfig] = useState({ whatsapp_taller: '', whatsapp_compras: '', whatsapp_jefe_operaciones: '' })
  const [savingWa, setSavingWa] = useState(false)

  const cargar = async () => {
    try {
      const data = await API.get('/api/usuarios')
      setUsuarios(data)
    } catch (e) { setError('Error cargando usuarios') }
  }

  useEffect(() => {
    cargar()
    api.get('/usuarios/tenant-config').then(({ data }) => setWaConfig({
      whatsapp_taller: data.whatsapp_taller || '',
      whatsapp_compras: data.whatsapp_compras || '',
      whatsapp_jefe_operaciones: data.whatsapp_jefe_operaciones || '',
    })).catch(() => {})
  }, [])

  const crear = async () => {
    if (!form.nombre || !form.email) return setError('Nombre y email requeridos')
    setLoading(true)
    setError('')
    try {
      await API.post('/api/usuarios', form)
      setForm({ nombre: '', email: '', rol: 'operario' })
      await cargar()
    } catch (e) { setError(e.message || 'Error creando usuario') }
    setLoading(false)
  }

  const toggleActivo = async (u) => {
    try {
      await API.patch(`/api/usuarios/${u.id}`, { activo: !u.activo })
      await cargar()
    } catch (e) { setError('Error actualizando usuario') }
  }

  const guardarWa = async () => {
    setSavingWa(true)
    try {
      await api.patch('/usuarios/tenant-config', waConfig)
      toast.success('Números de alerta guardados')
    } catch { toast.error('Error guardando configuración') }
    setSavingWa(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Usuarios</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-4">Nuevo usuario</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Nombre completo"
            value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
          />
          <input
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Correo electrónico"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={form.rol}
            onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
          >
            <option value="operario">Operario</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        <button
          onClick={crear}
          disabled={loading}
          className="mt-3 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {loading ? 'Creando...' : 'Crear usuario'}
        </button>
      </div>

      {/* Alertas WhatsApp */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-1">Alertas WhatsApp</h2>
        <p className="text-xs text-gray-400 mb-4">Números que reciben avisos de stock bajo e insumos. Formato: 50576926316 (sin + ni espacios)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Taller / Producción</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
              placeholder="50576926316"
              value={waConfig.whatsapp_taller}
              onChange={e => setWaConfig(c => ({ ...c, whatsapp_taller: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Compras / Insumos</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
              placeholder="50576926316"
              value={waConfig.whatsapp_compras}
              onChange={e => setWaConfig(c => ({ ...c, whatsapp_compras: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Jefe de Operaciones</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
              placeholder="50576926316"
              value={waConfig.whatsapp_jefe_operaciones}
              onChange={e => setWaConfig(c => ({ ...c, whatsapp_jefe_operaciones: e.target.value }))} />
          </div>
        </div>
        <button onClick={guardarWa} disabled={savingWa}
          className="mt-3 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
          {savingWa ? 'Guardando...' : 'Guardar números'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Rol</th>
              <th className="px-4 py-3 text-left">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usuarios.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.nombre}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.rol === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {u.rol}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActivo(u)}
                    className={`text-xs px-2 py-1 rounded-full font-medium ${u.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}