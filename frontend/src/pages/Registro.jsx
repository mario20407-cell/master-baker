import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Eye, EyeOff, ShieldCheck, Landmark, User, Mail, Lock } from 'lucide-react'

// Mismo patrón que AuthContext.jsx: en producción VITE_API_URL apunta directo
// al backend de Railway. La ruta relativa '/api/...' no sirve aquí porque
// Vercel no tiene un rewrite configurado para /api/* (solo el catch-all a
// index.html), así que un POST a esa ruta relativa devuelve 405 de Vercel.
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export default function Registro() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [nombreNegocio, setNombreNegocio] = useState('')
  const [nombreAdmin, setNombreAdmin] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [codigoInvitacion, setCodigoInvitacion] = useState('')
  const [cargando, setCargando] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nombreNegocio || !nombreAdmin || !email || !password || !codigoInvitacion) {
      toast.error('Todos los campos son requeridos')
      return
    }

    if (password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setCargando(true)
    try {
      const response = await axios.post(API + '/auth/registrar-negocio', {
        nombreNegocio,
        nombreAdmin,
        email,
        password,
        codigoInvitacion
      })

      const { token } = response.data
      localStorage.setItem('marquez_token', token)

      // Realizar login automático guardando los datos del usuario en el context
      await login(email.trim(), password)

      toast.success('¡Registro Exitoso! Bienvenido a tu demo de 30 días.')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al procesar el registro')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 transition-colors duration-200 py-10 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="bg-white/95 p-3 rounded-2xl inline-block shadow-sm mb-3">
            <img src="/branding/logo-completo.png" alt="Master Baker" className="h-16 mx-auto" />
          </div>
          <p className="text-sm font-semibold text-slate-300">Únete como Socio Fundador de Master Baker</p>
          <span className="inline-block mt-2 px-3 py-1 bg-[#8B6914]/20 text-[#C29C53] border border-[#C29C53]/30 text-xs font-semibold rounded-full">
            Prueba Gratuita de 30 días
          </span>
        </div>

        <div className="bg-navy-900/50 border border-[#C29C53]/30 rounded-2xl p-4 mb-4 text-xs text-slate-300 space-y-2">
          <p className="font-semibold text-sm mb-1 text-white">📋 Instructivo de Registro:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong className="text-[#C29C53]">Espacio Único:</strong> Al escribir el nombre de tu negocio se creará un espacio de base de datos aislado para tu panadería.</li>
            <li><strong className="text-[#C29C53]">Primer Usuario:</strong> Te registrarás como Administrador de tu negocio y podrás invitar a tus colaboradores después.</li>
            <li><strong className="text-[#C29C53]">Código Fundador:</strong> Necesitas ingresar el código provisto para validar tu cuenta.</li>
            <li><strong className="text-[#C29C53]">Período Demo:</strong> Obtienes 30 días de acceso total gratuito (IA, recetas, inventario, costeos y producción).</li>
          </ul>
        </div>

        <div className="bg-navy-900 rounded-2xl shadow-lg border border-navy-800 p-8 transition-colors duration-200">
          <h2 className="text-base font-medium text-white mb-6 flex items-center gap-2">
            Crear cuenta de negocio
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="form-label flex items-center gap-1.5 text-xs text-slate-350">
                <Landmark size={14} className="text-[#C29C53]" /> Nombre del Negocio / Panadería
              </label>
              <input
                type="text"
                value={nombreNegocio}
                onChange={e => setNombreNegocio(e.target.value)}
                placeholder="Ej. Panadería El Mana"
                disabled={cargando}
                className="w-full px-3.5 py-2 border rounded-lg bg-navy-950 border-navy-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#C29C53]/20 focus:border-[#C29C53]"
              />
            </div>

            <div className="form-group">
              <label className="form-label flex items-center gap-1.5 text-xs text-slate-350">
                <User size={14} className="text-[#C29C53]" /> Nombre del Administrador
              </label>
              <input
                type="text"
                value={nombreAdmin}
                onChange={e => setNombreAdmin(e.target.value)}
                placeholder="Ej. Juan Pérez"
                disabled={cargando}
                className="w-full px-3.5 py-2 border rounded-lg bg-navy-950 border-navy-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#C29C53]/20 focus:border-[#C29C53]"
              />
            </div>

            <div className="form-group">
              <label className="form-label flex items-center gap-1.5 text-xs text-slate-350">
                <Mail size={14} className="text-[#C29C53]" /> Correo Electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                disabled={cargando}
                className="w-full px-3.5 py-2 border rounded-lg bg-navy-950 border-navy-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#C29C53]/20 focus:border-[#C29C53]"
              />
            </div>

            <div className="form-group">
              <label className="form-label flex items-center gap-1.5 text-xs text-slate-350">
                <Lock size={14} className="text-[#C29C53]" /> Contraseña (Mín. 8 caracteres)
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={cargando}
                  className="w-full px-3.5 py-2 border rounded-lg bg-navy-950 border-navy-800 text-white placeholder-slate-500 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#C29C53]/20 focus:border-[#C29C53]"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label flex items-center gap-1.5 text-xs text-slate-350">
                <ShieldCheck size={14} className="text-[#C29C53]" /> Código de Invitación Fundador
              </label>
              <input
                type="text"
                value={codigoInvitacion}
                onChange={e => setCodigoInvitacion(e.target.value)}
                placeholder="Código de acceso"
                disabled={cargando}
                className="w-full px-3.5 py-2 border rounded-lg bg-navy-950 border-navy-800 text-white placeholder-slate-500 text-sm tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-[#C29C53]/20 focus:border-[#C29C53]"
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="btn-primary w-full py-2.5 mt-4 flex items-center justify-center gap-2"
            >
              {cargando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creando negocio...
                </>
              ) : 'Registrar Negocio'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            ¿Ya tienes un negocio registrado?{' '}
            <Link to="/login" className="text-[#C29C53] hover:text-[#C29C53]/85 hover:underline font-semibold">
              Iniciar Sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
