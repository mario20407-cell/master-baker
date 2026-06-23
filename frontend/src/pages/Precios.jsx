// pages/Precios.jsx
import { useState } from 'react'
import { Check, ChefHat, Zap, Crown, Send } from 'lucide-react'
const WHATSAPP = '50576926316'
const planes = [
  { id: 'starter', icon: ChefHat, nombre: 'Starter', precio: 350, descripcion: 'Ideal para panaderias pequenas', color: '#6B7280', features: ['Hasta 50 productos','Recetas y costeo ilimitadas','Control de inventario','Registro de ventas','Compras con IA','1 usuario operario','Soporte WhatsApp'] },
  { id: 'pro', icon: Zap, nombre: 'Pro', precio: 750, descripcion: 'Para panaderias en crecimiento', color: '#C29C53', destacado: true, features: ['Todo Starter','Productos ilimitados','Modulo produccion','Reportes PDF','Dashboard rentabilidad','3 usuarios operarios','Gestion fiscal DGI','Soporte prioritario'] },
  { id: 'plus', icon: Crown, nombre: 'Plus', precio: 1200, descripcion: 'Para cadenas y distribuidores', color: '#1D4ED8', features: ['Todo Pro','Usuarios ilimitados','Integracion Monica','GPS vendedores','API abierta','Multi-sucursal','Nomina','Gerente dedicado'] }
]
export default function Precios() {
  const [form, setForm] = useState({ nombre: '', panaderia: '', telefono: '', ciudad: '', plan: '' })
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [planSel, setPlanSel] = useState(null)
  const seleccionar = (p) => { setPlanSel(p); setForm(f => ({ ...f, plan: p.nombre })); setTimeout(() => document.getElementById('form')?.scrollIntoView({ behavior: 'smooth' }), 100) }
  const enviar = async () => {
    if (!form.nombre || !form.panaderia || !form.telefono || !form.plan) { alert('Completa todos los campos'); return }
    setEnviando(true)
    try {
      await fetch('https://formspree.io/f/xdkoznqw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      setEnviado(true)
      const msg = `Hola Mario! Me interesa Master Baker. Nombre: ${form.nombre}, Panaderia: ${form.panaderia}, Plan: ${form.plan}, Tel: ${form.telefono}`
      window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank')
    } catch { alert('Error al enviar') } finally { setEnviando(false) }
  }
  return (
    <div style={{ fontFamily: 'sans-serif', background: '#FAF8F4', minHeight: '100vh' }}>
      <div style={{ background: '#1a1a1a', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 24 }}>🍞</span>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>Master Baker</span>
        <span style={{ color: '#C29C53', fontSize: 13 }}>Sistema de gestion para panaderias</span>
      </div>
      <div style={{ textAlign: 'center', padding: '48px 24px 32px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1a1a1a', margin: '0 0 12px' }}>Cuanto te costo hacer una dona hoy?</h1>
        <p style={{ fontSize: 15, color: '#666', maxWidth: 480, margin: '0 auto' }}>Master Baker te dice el costo exacto, tu margen real y cuanto ganas por hornada.</p>
      </div>
      <div style={{ display: 'flex', gap: 20, maxWidth: 900, margin: '0 auto', padding: '0 24px 48px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {planes.map(p => {
          const Icon = p.icon
          return (
            <div key={p.id} style={{ background: '#fff', borderRadius: 16, padding: 28, flex: '1 1 240px', maxWidth: 280, border: p.destacado ? `2px solid ${p.color}` : '1px solid #E5E7EB', position: 'relative' }}>
              {p.destacado && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: p.color, color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20 }}>MAS POPULAR</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ background: p.color + '20', borderRadius: 10, padding: 8 }}><Icon size={20} color={p.color} /></div>
                <div><div style={{ fontWeight: 700, fontSize: 16 }}>{p.nombre}</div><div style={{ fontSize: 11, color: '#999' }}>{p.descripcion}</div></div>
              </div>
              <div style={{ marginBottom: 16 }}><span style={{ fontSize: 34, fontWeight: 800, color: p.color }}>C${p.precio}</span><span style={{ fontSize: 13, color: '#999' }}>/mes</span></div>
              <div style={{ marginBottom: 20 }}>{p.features.map((f, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}><Check size={13} color="#16a34a" style={{ marginTop: 2, flexShrink: 0 }} /><span style={{ fontSize: 13, color: '#444' }}>{f}</span></div>)}</div>
              <button onClick={() => seleccionar(p)} style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: planSel?.id === p.id ? p.color : p.destacado ? p.color : '#F3F4F6', color: planSel?.id === p.id || p.destacado ? '#fff' : '#1a1a1a', fontWeight: 700 }}>
                {planSel?.id === p.id ? 'Seleccionado' : 'Quiero este plan'}
              </button>
            </div>
          )
        })}
      </div>
      <div id="form" style={{ maxWidth: 500, margin: '0 auto', padding: '0 24px 64px' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, border: '1px solid #E5E7EB' }}>
          {enviado ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 48 }}>🎉</div>
              <h3 style={{ fontWeight: 700 }}>Registro recibido!</h3>
              <p style={{ color: '#666', fontSize: 14 }}>Te contactamos en menos de 24 horas por WhatsApp.</p>
            </div>
          ) : (
            <>
              <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Registra tu panaderia</h2>
              <p style={{ color: '#999', fontSize: 13, marginBottom: 20 }}>{planSel ? `Plan: ${planSel.nombre} - C$${planSel.precio}/mes` : 'Selecciona un plan arriba'}</p>
              {[['nombre','Nombre completo','Juan Perez'],['panaderia','Panaderia','Panaderia San Jose'],['telefono','WhatsApp','8888-8888'],['ciudad','Ciudad','Chinandega']].map(([k,l,ph]) => (
                <div key={k} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#444', display: 'block', marginBottom: 4 }}>{l} {k !== 'ciudad' ? '*' : ''}</label>
                  <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={ph} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#444', display: 'block', marginBottom: 4 }}>Plan *</label>
                <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 14, boxSizing: 'border-box', background: '#fff' }}>
                  <option value="">Selecciona un plan</option>
                  <option value="Starter">Starter - C$350/mes</option>
                  <option value="Pro">Pro - C$750/mes</option>
                  <option value="Plus">Plus - C$1,200/mes</option>
                </select>
              </div>
              <button onClick={enviar} disabled={enviando} style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#C29C53', color: '#fff', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Send size={15} /> {enviando ? 'Enviando...' : 'Registrarme ahora'}
              </button>
              <p style={{ textAlign: 'center', fontSize: 11, color: '#999', marginTop: 10 }}>Sin contratos. Cancela cuando quieras.</p>
            </>
          )}
        </div>
      </div>
      <div style={{ background: '#1a1a1a', padding: 24, textAlign: 'center' }}>
        <div style={{ color: '#fff', fontWeight: 700, marginBottom: 4 }}>🍞 Master Baker</div>
        <div style={{ color: '#666', fontSize: 12 }}>Chinandega, Nicaragua · mario20407@gmail.com · +505 7692-6316</div>
      </div>
    </div>
  )
}