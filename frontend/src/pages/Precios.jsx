// pages/Precios.jsx — Página pública de precios Master Baker
import { useState } from 'react'
import { Check, ChefHat, Zap, Crown, Send } from 'lucide-react'

const WHATSAPP = '50576926316'
const FORMSPREE = 'https://formspree.io/f/xdkoznqw'

const planes = [
  {
    id: 'starter',
    icon: ChefHat,
    nombre: 'Starter',
    precio: 350,
    descripcion: 'Ideal para panaderías pequeñas',
    color: '#6B7280',
    features: [
      'Hasta 50 productos en catálogo',
      'Recetas y costeo ilimitadas',
      'Control de inventario',
      'Registro de ventas',
      'Módulo de compras con IA',
      '1 usuario operario',
      'Soporte por WhatsApp',
    ]
  },
  {
    id: 'pro',
    icon: Zap,
    nombre: 'Pro',
    precio: 750,
    descripcion: 'Para panaderías en crecimiento',
    color: '#C29C53',
    destacado: true,
    features: [
      'Todo lo de Starter',
      'Productos ilimitados',
      'Módulo de producción',
      'Reportes PDF',
      'Dashboard de rentabilidad',
      '3 usuarios operarios',
      'Gestión fiscal DGI',
      'Soporte prioritario',
    ]
  },
  {
    id: 'plus',
    icon: Crown,
    nombre: 'Plus',
    precio: 1200,
    descripcion: 'Para cadenas y distribuidores',
    color: '#1D4ED8',
    features: [
      'Todo lo de Pro',
      'Usuarios ilimitados',
      'Integración contable (Mónica)',
      'Seguimiento GPS vendedores',
      'API abierta',
      'Panel multi-sucursal',
      'Nómina y planilla',
      'Gerente de cuenta dedicado',
    ]
  }
]

export default function Precios() {
  const [form, setForm] = useState({ nombre: '', panaderia: '', telefono: '', ciudad: '', plan: '' })
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [planSeleccionado, setPlanSeleccionado] = useState(null)

  const seleccionarPlan = (plan) => {
    setPlanSeleccionado(plan)
    setForm(f => ({ ...f, plan: plan.nombre }))
    setTimeout(() => {
      document.getElementById('formulario')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nombre || !form.panaderia || !form.telefono || !form.plan) {
      alert('Por favor completa todos los campos')
      return
    }
    setEnviando(true)
    try {
      await fetch(FORMSPREE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          _subject: `Nuevo registro Master Baker — Plan ${form.plan}`,
          _replyto: 'mario20407@gmail.com'
        })
      })
      setEnviado(true)
      const msg = `Hola Mario! Me interesa Master Baker.%0ANombre: ${encodeURIComponent(form.nombre)}%0APanadería: ${encodeURIComponent(form.panaderia)}%0APlan: ${form.plan}%0ATeléfono: ${form.telefono}%0ACiudad: ${encodeURIComponent(form.ciudad)}`
      window.open(`https://wa.me/${WHATSAPP}?text=${msg}`, '_blank')
    } catch {
      alert('Error al enviar. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', background: '#FAF8F4', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: '#1a1a1a', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 24 }}>🍞</span>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>Master Baker</span>
        <span style={{ color: '#C29C53', fontSize: 13, marginLeft: 4 }}>— Sistema de gestión para panaderías</span>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '48px 24px 32px' }}>
        <div style={{ fontSize: 13, color: '#C29C53', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Planes y Precios</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#1a1a1a', margin: '0 0 12px' }}>
          ¿Cuánto te costó hacer una dona hoy?
        </h1>
        <p style={{ fontSize: 16, color: '#666', maxWidth: 500, margin: '0 auto' }}>
          Master Baker te dice el costo exacto de cada producto, tu margen real y cuánto ganás por hornada. Todo desde tu celular.
        </p>
      </div>

      {/* Planes */}
      <div style={{ display: 'flex', gap: 20, maxWidth: 900, margin: '0 auto', padding: '0 24px 48px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {planes.map(plan => {
          const Icon = plan.icon
          const seleccionado = planSeleccionado?.id === plan.id
          return (
            <div key={plan.id} style={{
              background: '#fff',
              borderRadius: 16,
              padding: 28,
              flex: '1 1 240px',
              maxWidth: 280,
              border: plan.destacado ? `2px solid ${plan.color}` : '1px solid #E5E7EB',
              boxShadow: plan.destacado ? '0 8px 32px rgba(194,156,83,0.15)' : '0 2px 8px rgba(0,0,0,0.06)',
              position: 'relative',
              transition: 'transform 0.2s',
            }}>
              {plan.destacado && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: plan.color, color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20 }}>
                  MÁS POPULAR
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ background: plan.color + '20', borderRadius: 10, padding: 8 }}>
                  <Icon size={20} color={plan.color} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a1a' }}>{plan.nombre}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{plan.descripcion}</div>
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: plan.color }}>C${plan.precio}</span>
                <span style={{ fontSize: 13, color: '#999' }}>/mes</span>
              </div>
              <div style={{ marginBottom: 20 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <Check size={14} color='#16a34a' style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#444' }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => seleccionarPlan(plan)} style={{
                width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: seleccionado ? plan.color : plan.destacado ? plan.color : '#F3F4F6',
                color: seleccionado || plan.destacado ? '#fff' : '#1a1a1a',
                fontWeight: 700, fontSize: 14, transition: 'all 0.2s'
              }}>
                {seleccionado ? '✓ Seleccionado' : 'Quiero este plan'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Formulario */}
      <div id="formulario" style={{ maxWidth: 520, margin: '0 auto', padding: '0 24px 64px' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
          {enviado ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <h3 style={{ fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>¡Registro recibido!</h3>
              <p style={{ color: '#666', fontSize: 14 }}>Te contactaremos en menos de 24 horas por WhatsApp para activar tu cuenta.</p>
              <p style={{ color: '#C29C53', fontSize: 13, marginTop: 8 }}>También se abrió WhatsApp para contactarnos directamente.</p>
            </div>
          ) : (
            <>
              <h2 style={{ fontWeight: 700, fontSize: 20, color: '#1a1a1a', marginBottom: 4 }}>Registra tu panadería</h2>
              <p style={{ color: '#999', fontSize: 13, marginBottom: 24 }}>
                {planSeleccionado ? `Plan seleccionado: ${planSeleccionado.nombre} — C$${planSeleccionado.precio}/mes` : 'Selecciona un plan arriba o elige aquí'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12,