import { useState, useEffect } from 'react'
import { getMiPlan, getDatosPago, subirComprobante } from '../lib/suscripciones'
import toast from 'react-hot-toast'
import { CreditCard, Upload, CheckCircle, Clock, AlertTriangle, Copy } from 'lucide-react'

export default function Suscripcion() {
  const [plan, setPlan]         = useState(null)
  const [datos, setDatos]       = useState(null)
  const [cargando, setCargando] = useState(true)
  const [paso, setPaso]         = useState(1)
  const [comprobante, setComprobante] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pagado, setPagado]     = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    try {
      const [r1, r2] = await Promise.all([getMiPlan(), getDatosPago()])
      setPlan(r1.data)
      setDatos(r2.data)
    } catch (e) {
      toast.error('Error cargando datos de suscripción')
    } finally {
      setCargando(false)
    }
  }

  const copiar = (texto) => {
    navigator.clipboard.writeText(texto)
    toast.success('Copiado al portapapeles')
  }

  const enviarComprobante = async () => {
    if (!comprobante.trim()) {
      toast.error('Ingresa el enlace o número de comprobante')
      return
    }
    setEnviando(true)
    try {
      await subirComprobante({
        suscripcion_id: datos.suscripcion_id,
        referencia: datos.referencia,
        comprobante_url: comprobante,
        monto: datos.monto_mensual
      })
      setPagado(true)
      toast.success('¡Comprobante enviado! Te confirmaremos en menos de 24 horas.')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al enviar comprobante')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const diasRestantes = Math.max(0, Math.floor(plan?.dias_restantes || 0))
  const esTrial = plan?.estado === 'trial'
  const estaActivo = plan?.estado === 'activo'
  const vencido = plan?.estado_real === 'trial_vencido' || plan?.estado_real === 'pago_vencido'

  return (
    <div className="max-w-2xl space-y-6">

      {/* Banner de estado */}
      <div className={`rounded-xl p-4 flex items-start gap-3 ${
        estaActivo ? 'bg-green-50 border border-green-200' :
        vencido    ? 'bg-red-50 border border-red-200' :
                     'bg-amber-50 border border-amber-200'
      }`}>
        {estaActivo ? <CheckCircle className="text-green-600 mt-0.5" size={20} /> :
         vencido    ? <AlertTriangle className="text-red-600 mt-0.5" size={20} /> :
                      <Clock className="text-amber-600 mt-0.5" size={20} />}
        <div>
          <p className="font-semibold text-gray-800">
            {estaActivo ? `Plan ${plan?.plan?.toUpperCase()} activo` :
             vencido    ? 'Tu período ha vencido' :
                         `Período de prueba — ${diasRestantes} días restantes`}
          </p>
          <p className="text-sm text-gray-600 mt-0.5">
            {estaActivo ? `Vence el ${new Date(plan?.fin_pago).toLocaleDateString('es-NI')}` :
             vencido    ? 'Renueva tu suscripción para continuar usando Master Baker' :
                         `Vence el ${new Date(plan?.fin_trial).toLocaleDateString('es-NI')}`}
          </p>
        </div>
      </div>

      {/* Pantalla de éxito */}
      {pagado ? (
        <div className="card text-center py-12">
          <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">¡Comprobante recibido!</h2>
          <p className="text-gray-500">Verificaremos tu pago y activaremos tu cuenta en menos de 24 horas.</p>
          <p className="text-sm text-gray-400 mt-4">¿Preguntas? Escríbenos al WhatsApp de soporte.</p>
        </div>
      ) : (
        <>
          {/* Pasos */}
          <div className="flex items-center gap-2 mb-2">
            {[1,2,3].map(n => (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${paso >= n ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {n}
                </div>
                {n < 3 && <div className={`h-0.5 w-12 ${paso > n ? 'bg-amber-500' : 'bg-gray-200'}`} />}
              </div>
            ))}
            <div className="ml-2 text-sm text-gray-500">
              {paso === 1 ? 'Datos de pago' : paso === 2 ? 'Transferir' : 'Subir comprobante'}
            </div>
          </div>

          {/* Paso 1 — Resumen del plan */}
          {paso === 1 && datos && (
            <div className="card space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <CreditCard className="text-amber-500" size={22} />
                <h2 className="text-base font-semibold text-gray-800">Resumen de tu plan</h2>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Plan</span>
                  <span className="font-semibold text-gray-800">Plus — Usuarios ilimitados</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Precio especial fundador</span>
                  <span className="font-semibold text-amber-600">U${datos.monto_mensual}/mes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Precio regular</span>
                  <span className="text-gray-400 line-through">U$30/mes</span>
                </div>
                <div className="border-t border-amber-200 pt-2 flex justify-between">
                  <span className="font-semibold text-gray-800">Total a pagar</span>
                  <span className="font-bold text-lg text-amber-600">U${datos.monto_mensual}</span>
                </div>
              </div>
              <button onClick={() => setPaso(2)} className="btn-primary w-full py-2.5">
                Continuar con el pago →
              </button>
            </div>
          )}

          {/* Paso 2 — Datos bancarios */}
          {paso === 2 && datos && (
            <div className="card space-y-4">
              <h2 className="text-base font-semibold text-gray-800">Datos para la transferencia</h2>
              <div className="space-y-3">
                {[
                  { label: 'Banco', value: datos.banco },
                  { label: 'Número de cuenta', value: datos.cuenta },
                  { label: 'Tipo de cuenta', value: datos.tipo_cuenta },
                  { label: 'Beneficiario', value: datos.beneficiario },
                  { label: 'Monto exacto', value: `U$${datos.monto_mensual}` },
                  { label: 'Referencia (OBLIGATORIA)', value: datos.referencia, highlight: true },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className={`flex items-center justify-between p-3 rounded-lg ${highlight ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                    <div>
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className={`font-semibold ${highlight ? 'text-amber-700' : 'text-gray-800'}`}>{value}</p>
                    </div>
                    <button onClick={() => copiar(value)} className="p-1.5 hover:bg-white rounded-lg transition-colors">
                      <Copy size={14} className="text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700 font-semibold mb-1">⚠️ Importante</p>
                <p className="text-xs text-blue-600">Incluye la referencia <strong>{datos.referencia}</strong> en la descripción de tu transferencia para identificar tu pago.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPaso(1)} className="btn-secondary flex-1 py-2.5">← Volver</button>
                <button onClick={() => setPaso(3)} className="btn-primary flex-1 py-2.5">Ya transferí →</button>
              </div>
            </div>
          )}

          {/* Paso 3 — Subir comprobante */}
          {paso === 3 && (
            <div className="card space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Upload className="text-amber-500" size={22} />
                <h2 className="text-base font-semibold text-gray-800">Subir comprobante</h2>
              </div>
              <p className="text-sm text-gray-500">Ingresa el número de transacción o un enlace al comprobante de tu transferencia.</p>
              <div className="form-group">
                <label className="form-label">Número de transacción o enlace al comprobante</label>
                <input
                  type="text"
                  value={comprobante}
                  onChange={e => setComprobante(e.target.value)}
                  placeholder="Ej: TXN-2026-123456 o https://..."
                  className="w-full"
                />
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                <p>• Puedes encontrar el número de transacción en tu app bancaria</p>
                <p>• También puedes tomar una foto del comprobante y subir el enlace</p>
                <p>• Máximo 3 intentos por ciclo de pago</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPaso(2)} className="btn-secondary flex-1 py-2.5">← Volver</button>
                <button onClick={enviarComprobante} disabled={enviando} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2">
                  {enviando ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enviando...</> : 'Enviar comprobante'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
