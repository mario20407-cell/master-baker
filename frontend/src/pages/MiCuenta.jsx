import { useState, useEffect } from 'react'
import { cambiarMiPassword, getAdminPinEstado, setAdminPin } from '../lib/api'
import { KeyRound, Eye, EyeOff, Check, Shield } from 'lucide-react'
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

  // PIN de administrador (confirma cambios de precio en Catálogo/Inventario)
  const [pinConfigurado, setPinConfigurado] = useState(null)
  const [pinActual, setPinActual] = useState('')
  const [pinNuevo, setPinNuevo] = useState('')
  const [pinConfirmar, setPinConfirmar] = useState('')
  const [guardandoPin, setGuardandoPin] = useState(false)

  useEffect(() => {
    if (usuario?.rol === 'admin') {
      getAdminPinEstado()
        .then(({ data }) => setPinConfigurado(data.configurado))
        .catch(() => {})
    }
  }, [usuario])

  const handleGuardarPin = async (e) => {
    e.preventDefault()
    if (!pinNuevo || pinNuevo.length < 4) {
      toast.error('El PIN nuevo debe tener al menos 4 caracteres')
      return
    }
    if (pinNuevo !== pinConfirmar) {
      toast.error('La confirmación no coincide con el PIN nuevo')
      return
    }
    if (pinConfigurado && !pinActual) {
      toast.error('Ingresá el PIN actual para poder cambiarlo')
      return
    }
    setGuardandoPin(true)
    try {
      await setAdminPin(pinActual, pinNuevo)
      toast.success(pinConfigurado ? 'PIN actualizado correctamente' : 'PIN configurado correctamente')
      setPinConfigurado(true)
      setPinActual('')
      setPinNuevo('')
      setPinConfirmar('')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar el PIN')
    } finally {
      setGuardandoPin(false)
    }
  }

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

      {usuario?.rol === 'admin' && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-2">
            <Shield size={16} className="text-[#C29C53]" /> PIN de Administrador
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Se pide para confirmar cambios de precio en Catálogo e Inventario. Es propio de tu negocio —
            no lo comparten otros negocios en Master Baker.
            {pinConfigurado === false && (
              <span className="block mt-1 text-amber-600 dark:text-amber-500 font-medium">
                Todavía no configuraste un PIN — hacelo acá para poder editar precios.
              </span>
            )}
          </p>

          <form onSubmit={handleGuardarPin} className="space-y-4">
            {pinConfigurado && (
              <div className="form-group">
                <label className="form-label">PIN Actual</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinActual}
                  onChange={e => setPinActual(e.target.value)}
                  placeholder="PIN actual"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">PIN Nuevo</label>
              <input
                type="password"
                inputMode="numeric"
                value={pinNuevo}
                onChange={e => setPinNuevo(e.target.value)}
                placeholder="Min. 4 caracteres"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirmar PIN Nuevo</label>
              <input
                type="password"
                inputMode="numeric"
                value={pinConfirmar}
                onChange={e => setPinConfirmar(e.target.value)}
                placeholder="Repetí el PIN nuevo"
              />
            </div>

            <button
              type="submit"
              disabled={guardandoPin}
              className="btn-primary w-full py-2 text-sm flex justify-center items-center gap-1"
            >
              <Check size={14} /> {guardandoPin ? 'Guardando...' : pinConfigurado ? 'Cambiar PIN' : 'Configurar PIN'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
