import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, ChefHat, Calculator, Scale,
  Package, Receipt, ShoppingCart, Bot, Download, Menu, X, Shield, HelpCircle, LogOut, User, Users
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV_TODOS = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ventas',     icon: ShoppingCart,     label: 'Ventas',         badge: 'NEW' },
  { to: '/catalogo',   icon: BookOpen,         label: 'Catalogo' },
  { to: '/recetas',    icon: ChefHat,          label: 'Recetas',        badge: 'CLAVE' },
  { to: '/costeo',     icon: Calculator,       label: 'Costeo' },
  { to: '/escalado',   icon: Scale,            label: 'Escalado' },
  { to: '/inventario', icon: Package,          label: 'Inventario' },
  { to: '/compras',    icon: Receipt,          label: 'Compras' },
  { to: '/ia',         icon: Bot,              label: 'Consultar IA' },
  { to: '/fiscal',     icon: Shield,           label: 'Config. Fiscal', badge: 'DGI', soloAdmin: true },
  { to: '/usuarios',   icon: Users,            label: 'Usuarios',       soloAdmin: true },
  { to: '/ayuda',      icon: HelpCircle,       label: 'Ayuda' },
  { to: '/exportar',   icon: Download,         label: 'Exportar' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { usuario, logout } = useAuth()

  const esAdmin = usuario?.rol === 'admin'
  const NAV = NAV_TODOS.filter(n => !n.soloAdmin || esAdmin)
  const currentPage = NAV_TODOS.find(n => location.pathname.startsWith(n.to))?.label || 'Master Baker'

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-56 bg-white border-r border-gray-100 flex flex-col transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#263D4F' }}>
            <img src="/branding/logo-emblema.png" alt="Master Baker" className="w-9 h-9 object-contain" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight tracking-wide" style={{ color: '#263D4F' }}>MASTER BAKER</div>
            <div className="text-[10px] text-gray-400 leading-tight">Gestion Inteligente de Panaderia</div>
          </div>
          <button className="ml-auto lg:hidden text-gray-400" onClick={() => setSidebarOpen(false)}>
            <X size={16} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label, badge }) => (
            <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: badge === 'NEW' ? '#3B6D11' : badge === 'DGI' ? '#263D4F' : '#C29C53',
                    color: badge === 'NEW' ? '#fff' : badge === 'DGI' ? '#fff' : '#4F3C1C'
                  }}>
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          {usuario && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#EAF3DE' }}>
                <User size={12} style={{ color: '#27500A' }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-gray-700 truncate">{usuario.nombre}</div>
                <div className="text-[10px] text-gray-400 capitalize">{usuario.rol}</div>
              </div>
              <button onClick={logout} title="Cerrar sesion"
                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                <LogOut size={14} />
              </button>
            </div>
          )}
          <div className="text-xs text-gray-400">v3.0 · Margen objetivo 57%+</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button className="lg:hidden text-gray-500 hover:text-gray-700" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-semibold text-gray-900">{currentPage}</h1>
          <div className="ml-auto flex items-center gap-2">
            {!esAdmin && (
              <span className="text-xs px-2 py-1 rounded-md font-medium" style={{ background: '#F3F4F6', color: '#6B7280' }}>
                Operario
              </span>
            )}
            <span className="text-xs px-2 py-1 rounded-md font-medium" style={{ background: '#EAF3DE', color: '#27500A' }}>
              Margen objetivo: 57%+
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
