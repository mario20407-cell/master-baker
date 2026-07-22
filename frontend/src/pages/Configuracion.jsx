import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFiscalConfig } from '../hooks/useFiscalConfig'
import { usePasivosLaborales } from '../hooks/usePasivosLaborales'
import {
  updateNegocio,
  getSugerenciaManoObra,
  getConfiguracionCosteoSettings,
  saveConfiguracionCosteoSettings
} from '../lib/api'
import {
  Settings,
  Building,
  User,
  Shield,
  Wallet,
  Calculator,
  Percent,
  Flame,
  Lightbulb,
  DollarSign,
  TrendingUp,
  Info,
  Save,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Pencil,
  Plus,
  Trash2,
  Calendar,
  X,
  Check
} from 'lucide-react'
import toast from 'react-hot-toast'

const MESES_NOMBRE = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function formatoCordobas(n) {
  return 'C$' + (Number(n) || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Configuracion() {
  const { usuario, login } = useAuth()
  const [activeTab, setActiveTab] = useState('negocio')

  // Seccion 1: Negocio y Administrador
  const [negocioForm, setNegocioForm] = useState({
    nombreNegocio: usuario?.tenantNombre || '',
    nombreAdmin: usuario?.nombre || '',
    email: usuario?.email || ''
  })
  const [guardandoNegocio, setGuardandoNegocio] = useState(false)

  // Seccion 2: Dosier Fiscal (usando useFiscalConfig)
  const { config: configFiscal, guardar: guardarFiscal, loading: loadingFiscal } = useFiscalConfig()
  const [fiscalForm, setFiscalForm] = useState({
    regimen: '',
    cuota_fija: '',
    produccion_mensual: '',
    ir_anual: '',
    iva_aplica: 'Ninguno',
    nombre_negocio: '',
    ruc: '',
    configurado: false
  })

  useEffect(() => {
    if (configFiscal) {
      setFiscalForm(configFiscal)
    }
  }, [configFiscal])

  const handleGuardarFiscal = async () => {
    if (!fiscalForm.regimen) {
      toast.error('Selecciona un régimen fiscal')
      return
    }
    if (fiscalForm.regimen === 'cuota_fija' && !fiscalForm.cuota_fija) {
      toast.error('Ingresa la cuota fija mensual')
      return
    }
    if (!fiscalForm.produccion_mensual || parseInt(fiscalForm.produccion_mensual) < 1) {
      toast.error('La producción mensual debe ser al menos 1')
      return
    }
    await guardarFiscal(fiscalForm)
  }

  // Seccion 3: Nómina (usando usePasivosLaborales con autoload true)
  const {
    dossier,
    perfilesSinFecha,
    loading: loadingDossier,
    pagosVariables,
    loadingPagos,
    cargarDossier,
    guardarPerfil,
    cargarPagosVariables,
    guardarPagoVariable
  } = usePasivosLaborales(true)

  const [editPerfilUser, setEditPerfilUser] = useState(null)
  const [perfilForm, setPerfilForm] = useState({ tipo_pago: 'fijo', salario_mensual: '', fecha_ingreso: '' })
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [nuevoPago, setNuevoPago] = useState({ mes: new Date().toISOString().slice(0, 7), monto: '' })
  const [guardandoPago, setGuardandoPago] = useState(false)

  const handleAbrirPerfilLaboral = async (colaborador) => {
    setEditPerfilUser(colaborador)
    setPerfilForm({
      tipo_pago: colaborador.tipo_pago || colaborador.base?.fuente || 'fijo',
      salario_mensual: colaborador.salario_mensual || '',
      fecha_ingreso: colaborador.fecha_ingreso ? String(colaborador.fecha_ingreso).slice(0, 10) : ''
    })
    if ((colaborador.tipo_pago || colaborador.base?.fuente) === 'variable') {
      try {
        await cargarPagosVariables(colaborador.usuario_id || colaborador.id)
      } catch (e) {}
    }
  }

  const handleGuardarPerfilLaboral = async (e) => {
    e.preventDefault()
    if (!perfilForm.fecha_ingreso) {
      toast.error('La fecha de ingreso es requerida')
      return
    }
    if (perfilForm.tipo_pago === 'fijo' && !perfilForm.salario_mensual) {
      toast.error('Ingresa el salario mensual')
      return
    }
    setGuardandoPerfil(true)
    try {
      const usuarioId = editPerfilUser.usuario_id || editPerfilUser.id
      await guardarPerfil(usuarioId, {
        tipo_pago: perfilForm.tipo_pago,
        salario_mensual: perfilForm.tipo_pago === 'fijo' ? Number(perfilForm.salario_mensual) : null,
        fecha_ingreso: perfilForm.fecha_ingreso
      })
      if (perfilForm.tipo_pago !== 'variable') {
        setEditPerfilUser(null)
      }
    } catch (err) {
    } finally {
      setGuardandoPerfil(false)
    }
  }

  const handleGuardarPagoVariable = async (e) => {
    e.preventDefault()
    if (!nuevoPago.mes || nuevoPago.monto === '') {
      toast.error('Completa el mes y el monto pagado')
      return
    }
    setGuardandoPago(true)
    try {
      const usuarioId = editPerfilUser.usuario_id || editPerfilUser.id
      await guardarPagoVariable(usuarioId, nuevoPago.mes, Number(nuevoPago.monto))
      setNuevoPago({ mes: new Date().toISOString().slice(0, 7), monto: '' })
    } catch (err) {
    } finally {
      setGuardandoPago(false)
    }
  }

  // Seccion 4: Costeo e Indirectos (Mano de obra sugerida)
  const [costeoForm, setCosteoForm] = useState({
    costo_indirecto_gas: '',
    costo_indirecto_luz: '',
    costo_indirecto_mano: '',
    margen_objetivo: '57'
  })
  const [loadingCosteo, setLoadingCosteo] = useState(false)
  const [guardandoCosteo, setGuardandoCosteo] = useState(false)
  
  const [manoObraSugerida, setManoObraSugerida] = useState({ sugerido: null, motivo: null })
  const [loadingSugerencia, setLoadingSugerencia] = useState(false)

  const cargarCosteoConfig = async () => {
    setLoadingCosteo(true)
    try {
      const { data } = await getConfiguracionCosteoSettings()
      setCosteoForm({
        costo_indirecto_gas: data.costo_indirecto_gas ?? '',
        costo_indirecto_luz: data.costo_indirecto_luz ?? '',
        costo_indirecto_mano: data.costo_indirecto_mano ?? '',
        margen_objetivo: data.margen_objetivo ?? '57'
      })
    } catch (e) {
      toast.error('No se pudo cargar la configuración de costeo')
    } finally {
      setLoadingCosteo(false)
    }
  }

  const cargarSugerenciaManoObra = async () => {
    setLoadingSugerencia(true)
    try {
      const { data } = await getSugerenciaManoObra()
      setManoObraSugerida(data)
    } catch (e) {
      // Ignorar errores silenciosos en sugerencia
    } finally {
      setLoadingSugerencia(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'costeo') {
      cargarCosteoConfig()
      cargarSugerenciaManoObra()
    }
  }, [activeTab])

  const handleGuardarCosteo = async () => {
    setGuardandoCosteo(true)
    try {
      await saveConfiguracionCosteoSettings(costeoForm)
      toast.success('Configuración de costeo guardada')
    } catch (e) {
      toast.error('No se pudo guardar la configuración de costeo')
    } finally {
      setGuardandoCosteo(false)
    }
  }

  const handleUsarSugerencia = () => {
    if (manoObraSugerida.sugerido !== null) {
      setCosteoForm(prev => ({ ...prev, costo_indirecto_mano: manoObraSugerida.sugerido }))
      toast.success('Valor sugerido copiado al campo manual')
    }
  }

  // Guardar Negocio & Admin
  const handleGuardarNegocio = async (e) => {
    e.preventDefault()
    if (!negocioForm.nombreNegocio || !negocioForm.nombreAdmin || !negocioForm.email) {
      toast.error('Todos los campos son obligatorios')
      return
    }
    setGuardandoNegocio(true)
    try {
      const { data } = await updateNegocio(negocioForm)
      toast.success('Datos del negocio y administrador actualizados')
      // Refrescar datos en el Auth Context
      if (usuario) {
        usuario.nombre = data.usuario.nombre
        usuario.email = data.usuario.email
        usuario.tenantNombre = data.usuario.tenantNombre
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar los datos del negocio')
    } finally {
      setGuardandoNegocio(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-navy-900" style={{ background: '#263D4F' }}>
          <Settings size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-150">Ajustes & Configuración</h2>
          <p className="text-xs text-gray-400">Consolidado general de tu panadería y cuenta administrativa.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-navy-800">
        {[
          { id: 'negocio', label: 'Negocio & Cuenta', icon: Building },
          { id: 'fiscal', label: 'Dossier Fiscal', icon: Shield },
          { id: 'nomina', label: 'Nómina & Pasivos', icon: Wallet },
          { id: 'costeo', label: 'Costeo & Indirectos', icon: Calculator }
        ].map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2.5 px-4 font-medium text-xs border-b-2 transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-[#C29C53] text-[#C29C53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {/* TAB 1: Negocio & Admin */}
        {activeTab === 'negocio' && (
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-250 flex items-center gap-2">
              <Building size={16} className="text-[#C29C53]" /> Información del Negocio y Administrador
            </h3>
            <form onSubmit={handleGuardarNegocio} className="space-y-4 max-w-md">
              <div className="form-group">
                <label className="form-label text-xs">Nombre del Negocio / Panadería</label>
                <input
                  type="text"
                  value={negocioForm.nombreNegocio}
                  onChange={e => setNegocioForm(p => ({ ...p, nombreNegocio: e.target.value }))}
                  placeholder="Ej. Panadería El Mana"
                  className="text-xs"
                />
              </div>

              <div className="form-group">
                <label className="form-label text-xs">Nombre del Administrador</label>
                <input
                  type="text"
                  value={negocioForm.nombreAdmin}
                  onChange={e => setNegocioForm(p => ({ ...p, nombreAdmin: e.target.value }))}
                  placeholder="Ej. Juan Pérez"
                  className="text-xs"
                />
              </div>

              <div className="form-group">
                <label className="form-label text-xs">Correo Electrónico (Admin)</label>
                <input
                  type="email"
                  value={negocioForm.email}
                  onChange={e => setNegocioForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="admin@panaderia.com"
                  className="text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={guardandoNegocio}
                className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5 mt-2"
              >
                <Save size={14} />
                {guardandoNegocio ? 'Guardando...' : 'Guardar Información'}
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: Dosier Fiscal */}
        {activeTab === 'fiscal' && (
          <div className="space-y-4">
            {/* Aviso legal */}
            <div className="rounded-xl p-3 flex gap-2.5 text-xs bg-amber-50/50 dark:bg-amber-955/10 border border-amber-200/50 dark:border-amber-900/30">
              <Info size={14} className="flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
              <span className="text-amber-800 dark:text-amber-400">
                Esta configuración es orientativa para el cálculo interno de márgenes. Para declaraciones ante la DGI consulta a un contador colegiado (CCPN Nicaragua).
              </span>
            </div>

            <div className="card space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-250 flex items-center gap-2">
                <Shield size={16} className="text-[#C29C53]" /> Régimen Fiscal (DGI Nicaragua)
              </h3>

              <div className="grid grid-cols-2 gap-3 max-w-md">
                {[
                  { id: 'cuota_fija', label: 'Cuota Fija', desc: 'Ingresos < C$ 1,200,000/año. Pago mensual fijo.' },
                  { id: 'reg_general', label: 'Régimen General', desc: 'Ingresos > C$ 1,200,000/año. Declara IVA e IR.' }
                ].map(r => (
                  <button
                    key={r.id}
                    onClick={() => setFiscalForm(p => ({ ...p, regimen: r.id }))}
                    className="text-left p-3 rounded-xl border transition-all"
                    style={{
                      borderColor: fiscalForm.regimen === r.id ? '#C29C53' : '#e5e7eb',
                      background: fiscalForm.regimen === r.id ? '#FBF6EC' : 'white'
                    }}
                    type="button"
                  >
                    <span className="text-xs font-semibold text-gray-800 block">{r.label}</span>
                    <span className="text-[10px] text-gray-400 mt-1 block">{r.desc}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-lg">
                {fiscalForm.regimen === 'cuota_fija' && (
                  <>
                    <div className="form-group">
                      <label className="form-label text-xs">Cuota Fija mensual DGI (C$)</label>
                      <input
                        type="number"
                        value={fiscalForm.cuota_fija || ''}
                        onChange={e => setFiscalForm(p => ({ ...p, cuota_fija: e.target.value }))}
                        placeholder="Ej: 300"
                        className="text-xs"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label text-xs">IR anual estimado (C$, opcional)</label>
                      <input
                        type="number"
                        value={fiscalForm.ir_anual || ''}
                        onChange={e => setFiscalForm(p => ({ ...p, ir_anual: e.target.value }))}
                        placeholder="Ej: 0"
                        className="text-xs"
                      />
                    </div>
                  </>
                )}
                <div className="form-group col-span-2">
                  <label className="form-label text-xs font-semibold">Producción estimada mensual (unidades de pan/repostería)</label>
                  <input
                    type="number"
                    value={fiscalForm.produccion_mensual || ''}
                    onChange={e => setFiscalForm(p => ({ ...p, produccion_mensual: e.target.value }))}
                    placeholder="Ej. 10000"
                    className="text-xs"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Este dato se usará como denominador para sugerir el costo por mano de obra.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-lg border-t border-gray-150 pt-4">
                <div className="form-group">
                  <label className="form-label text-xs">RUC del negocio (opcional)</label>
                  <input
                    type="text"
                    value={fiscalForm.ruc || ''}
                    onChange={e => setFiscalForm(p => ({ ...p, ruc: e.target.value }))}
                    placeholder="J0310000000000"
                    className="text-xs"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label text-xs">Nombre legal o comercial</label>
                  <input
                    type="text"
                    value={fiscalForm.nombre_negocio || ''}
                    onChange={e => setFiscalForm(p => ({ ...p, nombre_negocio: e.target.value }))}
                    placeholder="Panadería Marquéz"
                    className="text-xs"
                  />
                </div>
              </div>

              <button
                onClick={handleGuardarFiscal}
                disabled={loadingFiscal}
                className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5"
                type="button"
              >
                <Save size={14} />
                {loadingFiscal ? 'Guardando...' : 'Guardar Configuración Fiscal'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Nómina & Pasivos Laborales */}
        {activeTab === 'nomina' && (
          <div className="space-y-4">
            <div className="card space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-250 flex items-center gap-2">
                <Wallet size={16} className="text-[#C29C53]" /> Gestión de Nómina y Colaboradores
              </h3>
              
              {loadingDossier ? (
                <div className="text-sm text-gray-400 py-6 text-center">Calculando pasivos y cargando nómina...</div>
              ) : !dossier || dossier.colaboradoresTotal === 0 ? (
                <div className="text-sm text-gray-400 py-6 text-center">No hay colaboradores configurados en el sistema.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Colaborador</th>
                        <th>Pago</th>
                        <th>Fecha Ingreso</th>
                        <th className="text-right">Sueldo Base</th>
                        <th className="text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.detalle.map(c => (
                        <tr key={c.usuario_id}>
                          <td className="font-medium text-gray-800 dark:text-gray-250">{c.nombre}</td>
                          <td>
                            <span className="badge-gray text-[10px]">
                              {c.tipo_pago === 'variable' ? 'Variable' : 'Fijo'}
                            </span>
                          </td>
                          <td className="text-xs text-gray-500">
                            {c.fecha_ingreso ? String(c.fecha_ingreso).slice(0, 10) : '—'}
                          </td>
                          <td className="text-right text-xs font-semibold">
                            {c.tipo_pago === 'variable' ? 'Varios' : formatoCordobas(c.base?.salario || 0)}
                          </td>
                          <td className="text-right">
                            <button
                              onClick={() => handleAbrirPerfilLaboral(c)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-450 hover:text-[#C29C53] transition-colors"
                              title="Editar Perfil"
                            >
                              <Pencil size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {perfilesSinFecha.map(p => (
                        <tr key={p.id} className="opacity-70 bg-amber-50/20">
                          <td className="font-medium text-gray-800 dark:text-gray-250">{p.nombre}</td>
                          <td colSpan={3} className="text-xs text-amber-600">
                            Falta fecha de ingreso o salario base.
                          </td>
                          <td className="text-right">
                            <button
                              onClick={() => handleAbrirPerfilLaboral(p)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-450 hover:text-[#C29C53] transition-colors"
                              title="Completar Perfil"
                            >
                              <Pencil size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Perfil Laboral */}
            {editPerfilUser && (
              <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50 p-4" onClick={() => setEditPerfilUser(null)}>
                <div className="card max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <Wallet size={16} className="text-[#C29C53]" /> Perfil Laboral: {editPerfilUser.nombre}
                    </h3>
                    <button onClick={() => setEditPerfilUser(null)} className="text-gray-450 hover:text-red-500">
                      <X size={16} />
                    </button>
                  </div>

                  <form onSubmit={handleGuardarPerfilLaboral} className="space-y-4">
                    <div className="form-group">
                      <label className="form-label text-xs flex items-center gap-1"><Calendar size={12} /> Fecha de Ingreso</label>
                      <input
                        type="date"
                        value={perfilForm.fecha_ingreso}
                        onChange={e => setPerfilForm(p => ({ ...p, fecha_ingreso: e.target.value }))}
                        className="text-xs py-1.5"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xs">Tipo de Pago</label>
                      <select
                        value={perfilForm.tipo_pago}
                        onChange={e => setPerfilForm(p => ({ ...p, tipo_pago: e.target.value }))}
                        className="text-xs py-1.5"
                      >
                        <option value="fijo">Salario fijo mensual</option>
                        <option value="variable">Variable / destajo (ej. por quintal)</option>
                      </select>
                    </div>

                    {perfilForm.tipo_pago === 'fijo' ? (
                      <div className="form-group">
                        <label className="form-label text-xs">Salario Mensual (C$)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={perfilForm.salario_mensual}
                          onChange={e => setPerfilForm(p => ({ ...p, salario_mensual: e.target.value }))}
                          placeholder="Ej. 8500"
                          className="text-xs py-1.5"
                        />
                      </div>
                    ) : (
                      <div className="space-y-3 border-t border-gray-150 pt-3">
                        <p className="text-[11px] text-gray-500">
                          Anota lo que realmente se le pagó cada mes.
                        </p>

                        <div className="flex gap-2 items-end">
                          <div className="form-group flex-1 mb-0">
                            <label className="form-label text-[10px]">Mes</label>
                            <input
                              type="month"
                              value={nuevoPago.mes}
                              onChange={e => setNuevoPago(p => ({ ...p, mes: e.target.value }))}
                              className="text-xs py-1.5"
                            />
                          </div>
                          <div className="form-group flex-1 mb-0">
                            <label className="form-label text-[10px]">Monto pagado (C$)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={nuevoPago.monto}
                              onChange={e => setNuevoPago(p => ({ ...p, monto: e.target.value }))}
                              placeholder="Ej. 4500"
                              className="text-xs py-1.5"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleGuardarPagoVariable}
                            disabled={guardandoPago}
                            className="btn-secondary py-1.5 px-3 text-xs whitespace-nowrap"
                          >
                            {guardandoPago ? 'Guardando...' : 'Agregar'}
                          </button>
                        </div>

                        {loadingPagos ? (
                          <p className="text-xs text-gray-400">Cargando historial...</p>
                        ) : pagosVariables.length === 0 ? (
                          <p className="text-xs text-gray-400">Sin pagos registrados todavía.</p>
                        ) : (
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {pagosVariables.map(p => {
                              const d = new Date(p.mes)
                              return (
                                <div key={p.mes} className="flex justify-between text-xs text-gray-600 py-0.5">
                                  <span>{MESES_NOMBRE[d.getUTCMonth()]} {d.getUTCFullYear()}</span>
                                  <span className="font-medium">{formatoCordobas(p.monto)}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={guardandoPerfil}
                        className="btn-primary flex-1 py-1.5 text-xs flex justify-center items-center gap-1"
                      >
                        <Check size={12} /> {guardandoPerfil ? 'Guardando...' : 'Guardar Perfil'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditPerfilUser(null)}
                        className="btn-secondary py-1.5 text-xs"
                      >
                        Cerrar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Costeo e Indirectos (Mano de obra sugerida) */}
        {activeTab === 'costeo' && (
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-250 flex items-center gap-2">
              <Calculator size={16} className="text-[#C29C53]" /> Ajustes de Costeo & Gastos Indirectos
            </h3>

            {loadingCosteo ? (
              <div className="text-sm text-gray-400 py-6 text-center">Cargando configuración...</div>
            ) : (
              <div className="space-y-4 max-w-lg">
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label text-xs">Costo indirecto Gas (C$ / tanda)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={costeoForm.costo_indirecto_gas}
                      onChange={e => setCosteoForm(p => ({ ...p, costo_indirecto_gas: e.target.value }))}
                      placeholder="0.00"
                      className="text-xs"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label text-xs">Costo indirecto Luz/Servicios (C$ / tanda)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={costeoForm.costo_indirecto_luz}
                      onChange={e => setCosteoForm(p => ({ ...p, costo_indirecto_luz: e.target.value }))}
                      placeholder="0.00"
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label text-xs">Margen de ganancia objetivo (%)</label>
                  <input
                    type="number"
                    value={costeoForm.margen_objetivo}
                    onChange={e => setCosteoForm(p => ({ ...p, margen_objetivo: e.target.value }))}
                    placeholder="57"
                    className="text-xs"
                  />
                </div>

                <div className="border-t border-gray-150 pt-4 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-800">Costo de Mano de Obra</h4>
                  
                  {loadingSugerencia ? (
                    <div className="text-xs text-gray-400">Calculando mano de obra sugerida...</div>
                  ) : manoObraSugerida.sugerido !== null ? (
                    <div className="rounded-xl p-3 bg-green-50/50 border border-green-200/50 flex flex-col sm:flex-row justify-between sm:items-center gap-2.5">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-green-700 tracking-wider">Mano de Obra Sugerida</span>
                        <p className="text-base font-bold text-green-800">{formatoCordobas(manoObraSugerida.sugerido)} <span className="text-[10px] font-normal text-green-600">por pieza</span></p>
                        <p className="text-[9px] text-green-600">Calculado dinámicamente con nómina activa y producción mensual ({configFiscal?.produccion_mensual || 0} piezas).</p>
                      </div>
                      <button
                        onClick={handleUsarSugerencia}
                        className="btn-primary text-[10px] py-1.5 px-3 self-start sm:self-auto bg-green-700 hover:bg-green-800 text-white flex items-center gap-1 border-none shadow-none"
                        type="button"
                      >
                        <Check size={12} />
                        Usar este valor
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl p-3 bg-gray-50 border border-gray-200 text-xs text-gray-500">
                      ⚠️ Todavía no hay suficientes datos de nómina o producción mensual para sugerir un costo.
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label text-xs">Costo de Mano de obra aplicado (C$ / pieza)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={costeoForm.costo_indirecto_mano}
                      onChange={e => setCosteoForm(p => ({ ...p, costo_indirecto_mano: e.target.value }))}
                      placeholder="0.00"
                      className="text-xs"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Este es el valor final de mano de obra que se aplicará en el módulo de Costeo de recetas.</p>
                  </div>
                </div>

                <button
                  onClick={handleGuardarCosteo}
                  disabled={guardandoCosteo}
                  className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5 mt-2"
                  type="button"
                >
                  <Save size={14} />
                  {guardandoCosteo ? 'Guardando...' : 'Guardar Costeo e Indirectos'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
