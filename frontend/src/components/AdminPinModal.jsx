/**
 * AdminPinModal.jsx
 *
 * Modal reutilizable que pide el PIN de Admin antes de confirmar una
 * acción sensible (editar precio de producto o costo de insumo).
 *
 * USO:
 *   const [pinModal, setPinModal] = useState(null) // null | { onConfirm: fn }
 *   ...
 *   setPinModal({ onConfirm: (pin) => guardarConPin(pin) })
 *   ...
 *   <AdminPinModal abierto={!!pinModal} onCerrar={() => setPinModal(null)}
 *     onConfirmar={(pin) => { pinModal.onConfirm(pin); setPinModal(null) }} />
 *
 * El PIN se manda al backend en el header x-admin-pin — nunca se guarda
 * en localStorage ni en el estado más allá de lo necesario para esa
 * única confirmación.
 */
import { useState } from 'react'
import { Shield, X } from 'lucide-react'

export default function AdminPinModal({ abierto, onCerrar, onConfirmar, titulo = 'Confirmación de Administrador' }) {
  const [pin, setPin] = useState('')

  if (!abierto) return null

  const confirmar = () => {
    if (!pin.trim()) return
    onConfirmar(pin.trim())
    setPin('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(27,44,57,0.5)' }}
      onClick={onCerrar}>
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#263D4F' }}>
              <Shield size={15} className="text-white" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">{titulo}</h3>
          </div>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          Esta acción cambia un precio en el sistema. Ingresa el PIN de administrador para confirmar.
        </p>

        <input
          type="password"
          autoFocus
          value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirmar() }}
          placeholder="PIN de administrador"
          className="w-full mb-3 text-center text-lg tracking-widest"
        />

        <div className="flex gap-2">
          <button onClick={onCerrar} className="flex-1 btn-secondary text-sm">Cancelar</button>
          <button onClick={confirmar} className="flex-1 btn-primary text-sm">Confirmar</button>
        </div>
      </div>
    </div>
  )
}
