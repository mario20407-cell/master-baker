import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate   = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Ingresa tu email y Contraseña'); return }
    setCargando(true)
    try {
      await login(email.trim(), password)
      toast.success('Bienvenido')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Credenciales incorrectas')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF8F4' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/branding/logo-completo.png" alt="Master Baker" className="h-32 mx-auto" style={{ mixBlendMode: 'multiply' }} />
          <p className="text-sm text-gray-500 mt-1">Sistema de gestión para panaderías</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-base font-medium text-gray-700 mb-6">Iniciar sesión</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="form-label">Correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@marquez.com" autoComplete="email" autoFocus disabled={cargando} />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" disabled={cargando} className="pr-10 w-full" />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={cargando}
              className="btn-primary w-full py-2.5 mt-2 flex items-center justify-center gap-2">
              {cargando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verificando...
                </>
              ) : 'Entrar'}
            </button>
            <button type="button" onClick={() => toast('Para restablecer tu contraseña, contacta al administrador del sistema')} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-2">Olvidé mi contraseña</button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          Marquéz Panadería & Repostería · Chichigalpa, Nicaragua
        </p>
      </div>
    </div>
  )
}