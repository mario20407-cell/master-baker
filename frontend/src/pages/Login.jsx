import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
  const [opciones, setOpciones] = useState([])
  const [negocioElegido, setNegocioElegido] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Ingresa tu email y Contraseña'); return }
    setCargando(true)
    try {
      await login(email.trim(), password, negocioElegido || undefined)
      toast.success('Bienvenido')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (err.response?.data?.necesitaNegocio) {
        setOpciones(err.response.data.opciones || [])
        return
      }
      toast.error(err.response?.data?.error || 'Credenciales incorrectas')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF8F4] dark:bg-navy-950 transition-colors duration-200">
      <div className="w-full max-w-sm">
        <div className="text-center mb-2">
          <img src="/branding/logo-completo.png" alt="Master Baker" className="h-32 mx-auto" style={{ mixBlendMode: 'multiply' }} />
          <p className="text-base font-semibold text-gray-600 dark:text-gray-400 mt-1">Sistema de gestión para panaderías</p>
          <p className="text-sm mt-1 italic font-bold" style={{ color: '#8B6914' }}>&quot;Danos el pan nuestro de cada día&quot;</p>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-sm border border-gray-100 dark:border-navy-800 p-8 mt-2 transition-colors duration-200">
          <h2 className="text-base font-medium text-gray-700 dark:text-gray-200 mb-6">Iniciar sesión</h2>
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
            {opciones.length > 0 && (
              <div className="form-group">
                <label className="form-label">Ese email existe en más de un negocio, elegí con cuál entrar</label>
                <select value={negocioElegido} onChange={e => setNegocioElegido(e.target.value)} disabled={cargando}>
                  <option value="">Seleccioná un negocio…</option>
                  {opciones.map(o => (
                    <option key={o.slug} value={o.slug}>{o.nombre}</option>
                  ))}
                </select>
              </div>
            )}
            <button type="submit" disabled={cargando || (opciones.length > 0 && !negocioElegido)}
              className="btn-primary w-full py-2.5 mt-2 flex items-center justify-center gap-2">
              {cargando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verificando...
                </>
              ) : 'Entrar'}
            </button>
            <button type="button" onClick={() => toast("Por ahora no hay reseteo automático. Pedile a un administrador que te restablezca la contraseña desde 'Mi Equipo', o contactanos directamente.")} className="w-full text-center text-xs text-gray-400 hover:text-gray-700 mt-2">Olvidé mi contraseña</button>
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-navy-800 text-center text-xs text-gray-500 dark:text-gray-400">
              ¿Eres socio fundador?{' '}
              <Link to="/registro" className="text-amber-700 hover:underline font-semibold">
                Registra tu negocio
              </Link>
            </div>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          Marquéz Panadería & Repostería · Chichigalpa, Nicaragua
        </p>
        <p className="text-center text-xs mt-1" style={{ color: '#C29C53' }}>
          Leiva Cruz Developments · Chichigalpa, Nicaragua
        </p>
      </div>
    </div>
  )
}
