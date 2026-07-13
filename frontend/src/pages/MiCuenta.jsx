import { useState } from 'react'
import { cambiarMiPassword } from '../lib/api'
import { KeyRound, Eye, EyeOff, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export default function MiCuenta() {
  const { usuario } = useAuth()

  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNueva, setPasswordNueva] = useState('')
  const [passwordConfirmar, setPasswordConfirmar] = useState('')
  const [showActual, setShowActual] = useState(false)
  const [showNueva, setShowNueva] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const handleCambiarPassword = async (e) => {
    e.preventDefault()
    if (!passwordActual || !passwordNueva || !passwordConfirmar) {
      toast.error('Todos los campos son obligatorios')
      return
    }
    if (passwordNueva.length < 8) {
      toast.error('La contraseña nueva debe tener al menos 8 caracteres')
      return
    }
    if (passwordNueva !== passwordConfirmar) {
      toast.error('La confirmación no coincide con la contraseña nueva')
      return
    }

    setGuardando(true)
    try {
      await cambiarMiPassword(passwordActual, passwordNueva)
      toast.success('Contraseña actualizada correctamente')
      setPasswordActual('')
      setPasswordNueva('')
      setPasswordConfirmar('')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al actualizar la contraseña')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="max-w-md space-y-6">
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-2">
          <KeyRound size={16} className="text-[#C29C53]" /> Mi Cuenta
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {usuario?.nombre} — {usuario?.email}
        </p>

        <form onSubmit={handleCambiarPassword} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Contraseña Actual</label>
            <div className="relative">
              <input
                type={showActual ? 'text' : 'password'}
                value={passwordActual}
                onChange={e => setPasswordActual(e.target.value)}
                placeholder="Tu contraseña actual"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowActual(!showActual)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showActual ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña Nueva</label>
            <div className="relative">
              <input
                type={showNueva ? 'text' : 'password'}
                value={passwordNueva}
                onChange={e => setPasswordNueva(e.target.value)}
                placeholder="Min. 8 caracteres"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNueva(!showNueva)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showNueva ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Confirmar Contraseña Nueva</label>
            <div className="relative">
              <input
                type={showConfirmar ? 'text' : 'password'}
                value={passwordConfirmar}
                onChange={e => setPasswordConfirmar(e.target.value)}
                placeholder="Repetí la contraseña nueva"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmar(!showConfirmar)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showConfirmar ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="btn-primary w-full py-2 text-sm flex justify-center items-center gap-1"
          >
            <Check size={14} /> {guardando ? 'Guardando...' : 'Cambiar Contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
