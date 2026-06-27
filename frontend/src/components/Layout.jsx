import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, ShoppingCart, BookOpen, Calculator, Scale,
  Package, ShoppingBag, BarChart2, Bot, Download, Shield,
  Settings, Users, HelpCircle, CreditCard, LogOut, ChefHat,
  Receipt, TrendingUp
} from 'lucide-react'

const navItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ventas',     icon: ShoppingCart,    label: 'Ventas',    badge: 'NEW' },
  { to: '/catalogo',   icon: ChefHat,         label: 'Catálogo' },
  { to: '/recetas',    icon: BookOpen,        label: 'Recetas',   badge: 'CLAVE' },
  { to: '/costeo',     icon: Calculator,      label: 'Costeo' },
  { to: '/escalado',   icon: Scale,           label: 'Escalado' },
  { to: '/inventario', icon: Package,         label: 'Inventario' },
  { to: '/produccion', icon: TrendingUp,      label: 'Producción', badge: 'NEW' },
  { to: '/compras',    icon: ShoppingBag,     label: 'Compras' },
  { to: '/reportes',   icon: BarChart2,       label: 'Reportes' },
  { to: '/suscripcion',icon: CreditCard,      label: 'Mi Plan' },
  { to: '/politicas',  icon: Shield,          label: 'Políticas' },
  { to: '/ia',         icon: Bot,             label: 'Consultar IA' },
  { to: '/fiscal',     icon: Settings,        label: 'Config. Fiscal', badge: 'DGI', soloAdmin: true },
  { to: '/usuarios',   icon: Users,           label: 'Usuarios', soloAdmin: true },
  { to: '/ayuda',      icon: HelpCircle,      label: 'Ayuda' },
  { to: '/exportar',   icon: Download,        label: 'Exportar' },
]

const badgeColors = {
  NEW:  { bg: '#1A7A4A', color: '#fff' },
  CLAVE:{ bg: '#854F0B', color: '#fff' },
  DGI:  { bg: '#1B2A4A', color: '#fff' },
}

export default function Layout() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }
  const isAdmin = usuario?.rol === 'admin'
  const initials = usuario?.nombre?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || 'MB'

  return (
    <div style={{ display:'flex', height:'100vh', background:'#f0f2f5', fontFamily:'system-ui,sans-serif' }}>

      {/* SIDEBAR */}
      <aside style={{
        width: collapsed ? 56 : 210,
        minWidth: collapsed ? 56 : 210,
        background: '#1B2A4A',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width .2s',
        overflow: 'hidden',
        borderRight: '1px solid #263d63'
      }}>

        {/* Logo */}
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #263d63', flexShrink:0 }}>
          {!collapsed && (
            <>
              <img src='/branding/logo-completo.png' alt='Master Baker' style={{ height:48, objectFit:'contain' }} />
              <div style={{ color:'#888B8D', fontSize:10, marginTop:4 }}>{usuario?.negocio || 'Panadería'}</div>
            </>
          )}
          {collapsed && <img src='/branding/logo-emblema.png' alt='MB' style={{ height:32, objectFit:'contain' }} />}
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
          {navItems.filter(item => !item.soloAdmin || isAdmin).map(({ to, icon: Icon, label, badge }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: collapsed ? '8px 16px' : '7px 16px',
              color: isActive ? '#ffffff' : '#888B8D',
              background: isActive ? '#243d63' : 'transparent',
              borderLeft: isActive ? '3px solid #C29C53' : '3px solid transparent',
              textDecoration: 'none',
              fontSize: 11,
              fontWeight: isActive ? 700 : 400,
              whiteSpace: 'nowrap',
              transition: 'all .15s'
            })}>
              <Icon size={15} style={{ flexShrink:0 }} />
              {!collapsed && (
                <>
                  <span style={{ flex:1 }}>{label}</span>
                  {badge && (
                    <span style={{
                      fontSize:9, fontWeight:700,
                      padding:'2px 5px', borderRadius:3,
                      background: badgeColors[badge]?.bg || '#888',
                      color: badgeColors[badge]?.color || '#fff'
                    }}>{badge}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        {!collapsed && (
          <div style={{ padding:'10px 16px', borderTop:'1px solid #263d63', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{
                width:28, height:28, borderRadius:'50%',
                background:'#C29C53', display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:10, fontWeight:700,
                color:'#1B2A4A', flexShrink:0
              }}>{initials}</div>
              <div>
                <div style={{ color:'#e0e2e3', fontSize:10, fontWeight:700 }}>{usuario?.nombre}</div>
                <div style={{ color:'#888B8D', fontSize:9 }}>{usuario?.rol}</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* MAIN */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* TOPBAR */}
        <header style={{
          background:'#ffffff',
          padding:'10px 24px',
          borderBottom:'0.5px solid #c8cbcd',
          display:'flex',
          alignItems:'center',
          justifyContent:'space-between',
          flexShrink:0
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={() => setCollapsed(!collapsed)} style={{
              border:'none', background:'transparent', cursor:'pointer',
              color:'#888B8D', padding:4, display:'flex'
            }}>
              <LayoutDashboard size={18} />
            </button>
            <div>
              <div style={{ color:'#1B2A4A', fontSize:14, fontWeight:700 }}>Master Baker</div>
              <div style={{ color:'#888B8D', fontSize:10 }}>{usuario?.negocio || 'Panel de gestión'}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{
              background:'#FBF5E9', color:'#854F0B',
              fontSize:11, padding:'5px 10px',
              borderRadius:6, fontWeight:700
            }}>v3.5</span>
            <button onClick={handleLogout} style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'8px 18px',
              background:'#C0392B',
              color:'#fff',
              border:'none',
              borderRadius:8,
              fontSize:13,
              fontWeight:700,
              cursor:'pointer'
            }}>
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* CONTENT */}
        <main style={{ flex:1, overflowY:'auto', padding:'24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
