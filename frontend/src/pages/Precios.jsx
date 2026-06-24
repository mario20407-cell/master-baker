// pages/Precios.jsx
import { useState } from 'react'
import { Check, ChefHat, Zap, Crown, Send } from 'lucide-react'

const WHATSAPP = '50576926316'
const FORMSPREE = 'https://formspree.io/f/xdkoznqw'
const TC = 36.50

const planes = [
  { id: 'starter', icon: ChefHat, nombre: 'Starter', usd: 10, descripcion: 'Ideal para panaderías pequeñas', color: '#A78BFA', features: ['Hasta 50 productos en catálogo','Recetas y costeo ilimitadas','Control de inventario','Registro de ventas','Compras con IA','1 usuario operario','Soporte por WhatsApp'] },
  { id: 'pro', icon: Zap, nombre: 'Pro', usd: 20, descripcion: 'Para panaderías en crecimiento', color: '#F59E0B', destacado: true, features: ['Todo lo de Starter','Productos ilimitados','Módulo de producción','Reportes PDF','Dashboard de rentabilidad','3 usuarios operarios','Gestión fiscal DGI','Soporte prioritario'] },
  { id: 'plus', icon: Crown, nombre: 'Plus', usd: 30, descripcion: 'Para cadenas y distribuidores', color: '#38BDF8', features: ['Todo lo de Pro','Usuarios ilimitados','Integracion Monica','GPS vendedores','API abierta','Multi-sucursal','Nomina y planilla','Gerente dedicado'] }
]

export default function Precios() {
  const [form, setForm] = useState({ nombre: '', panaderia: '', telefono: '', ciudad: '', plan: '' })
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [planSel, setPlanSel] = useState(null)

  const seleccionar = (p) => { setPlanSel(p); setForm(f => ({ ...f, plan: p.nombre })); setTimeout(() => document.getElementById('formulario')?.scrollIntoView({ behavior: 'smooth' }), 100) }

  const enviar = async () => {
    if (!form.nombre || !form.panaderia || !form.telefono || !form.plan) { alert('Completa todos los campos requeridos'); return }
    setEnviando(true)
    try {
      await fetch(FORMSPREE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, _subject: `Nuevo registro Master Baker - Plan ${form.plan}` }) })
      setEnviado(true)
      const msg = `Hola Mario! Me interesa Master Baker.%0ANombre: ${encodeURIComponent(form.nombre)}%0APanaderia: ${encodeURIComponent(form.panaderia)}%0APlan: ${form.plan}%0ATel: ${form.telefono}%0ACiudad: ${encodeURIComponent(form.ciudad)}`
      window.open(`https://wa.me/${WHATSAPP}?text=${msg}`, '_blank')
    } catch { alert('Error al enviar. Intenta de nuevo.') } finally { setEnviando(false) }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', background: '#0F1117', minHeight: '100vh' }}>

      <div style={{ background: '#1a1d27', borderBottom: '1px solid #2a2d3a', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <img src="/branding/logo-completo.png" alt="Master Baker" style={{ height: 90, objectFit: 'contain' }} />
        <span style={{ color: '#F59E0B', fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' }}>Sistema de Gestion para Panaderias</span>
      </div>

      <div style={{ textAlign: 'center', padding: '56px 24px 36px' }}>
        <div style={{ fontSize: 12, color: '#F59E0B', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 2 }}>Planes y Precios</div>
        <h1 style={{ fontSize: 36, fontWeight: 900, color: '#ffffff', margin: '0 0 16px', lineHeight: 1.2 }}>Cuanto te costo hacer<br/>una dona hoy?</h1>
        <p style={{ fontSize: 16, color: '#9CA3AF', maxWidth: 480, margin: '0 auto' }}>Master Baker te dice el costo exacto, tu margen real y cuanto ganas por hornada.</p>
      </div>

      <div style={{ display: 'flex', gap: 20, maxWidth: 960, margin: '0 auto', padding: '0 24px 56px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {planes.map(p => {
          const Icon = p.icon
          const crd = Math.round(p.usd * TC)
          const sel = planSel?.id === p.id
          return (
            <div key={p.id} style={{ background: p.destacado ? '#1E2030' : '#161824', borderRadius: 20, padding: 32, flex: '1 1 260px', maxWidth: 290, border: p.destacado ? `2px solid ${p.color}` : '1px solid #2a2d3a', boxShadow: p.destacado ? `0 0 40px ${p.color}30` : 'none', position: 'relative' }}>
              {p.destacado && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: p.color, color: '#000', fontSize: 11, fontWeight: 800, padding: '5px 16px', borderRadius: 20, whiteSpace: 'nowrap' }}>MAS POPULAR</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ background: p.color + '25', borderRadius: 12, padding: 10 }}><Icon size={22} color={p.color} /></div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>{p.nombre}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{p.descripcion}</div>
                </div>
              </div>
              <div style={{ marginBottom: 24 }}>
                <div><span style={{ fontSize: 42, fontWeight: 900, color: p.color }}>U${p.usd}</span><span style={{ fontSize: 14, color: '#6B7280' }}>/mes</span></div>
                <div style={{ fontSize: 13, color: '#4B5563', marginTop: 4 }}>≈ C${crd.toLocaleString()}/mes</div>
              </div>
              <div style={{ marginBottom: 24 }}>
                {p.features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <Check size={14} color={p.color} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#D1D5DB' }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => seleccionar(p)} style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', cursor: 'pointer', background: sel ? p.color : p.destacado ? p.color : '#2a2d3a', color: sel || p.destacado ? '#000' : '#fff', fontWeight: 800, fontSize: 14 }}>
                {sel ? 'Seleccionado' : 'Quiero este plan'}
              </button>
            </div>
          )
        })}
      </div>

      <div id="formulario" style={{ maxWidth: 500, margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ background: '#161824', borderRadius: 20, padding: 36, border: '1px solid #2a2d3a' }}>
          {enviado ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
              <h3 style={{ fontWeight: 800, color: '#fff', marginBottom: 8, fontSize: 22 }}>Registro recibido!</h3>
              <p style={{ color: '#9CA3AF', fontSize: 14 }}>Te contactamos en menos de 24 horas por WhatsApp para activar tu cuenta.</p>
            </div>
          ) : (
            <>
              <h2 style={{ fontWeight: 800, fontSize: 22, color: '#fff', marginBottom: 4 }}>Registra tu panaderia</h2>
              <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 24 }}>{planSel ? `Plan seleccionado: ${planSel.nombre} — U$${planSel.usd}/mes` : 'Selecciona un plan arriba o elige aqui'}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[['nombre','Nombre completo','Juan Perez'],['panaderia','Tu panaderia','Panaderia San Jose'],['telefono','WhatsApp','8888-8888'],['ciudad','Ciudad','Chinandega']].map(([k,l,ph]) => (
                  <div key={k}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6 }}>{l}{k !== 'ciudad' ? ' *' : ''}</label>
                    <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={ph} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #2a2d3a', fontSize: 14, boxSizing: 'border-box', background: '#0F1117', color: '#fff' }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6 }}>Plan de interes *</label>
                  <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #2a2d3a', fontSize: 14, boxSizing: 'border-box', background: '#0F1117', color: '#fff' }}>
                    <option value="">Selecciona un plan</option>
                    <option value="Starter">Starter — U$10/mes (≈ C$365)</option>
                    <option value="Pro">Pro — U$20/mes (≈ C$730)</option>
                    <option value="Plus">Plus — U$30/mes (≈ C$1,095)</option>
                  </select>
                </div>
                <button onClick={enviar} disabled={enviando} style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer', background: '#F59E0B', color: '#000', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: enviando ? 0.7 : 1 }}>
                  <Send size={16} /> {enviando ? 'Enviando...' : 'Registrarme ahora'}
                </button>
                <p style={{ textAlign: 'center', fontSize: 11, color: '#4B5563', margin: 0 }}>Sin contratos. Cancela cuando quieras.</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ background: '#1a1d27', borderTop: '1px solid #2a2d3a', padding: '36px', textAlign: 'center' }}>
        <img src="/branding/logo-completo.png" alt="Master Baker" style={{ height: 60, objectFit: 'contain', marginBottom: 12 }} />
        <div style={{ color: '#4B5563', fontSize: 12 }}>Chinandega, Nicaragua · mario20407@gmail.com · +505 7692-6316</div>
      </div>

    </div>
  )
}