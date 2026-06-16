import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, ChefHat, Calculator, Scale,
  Package, Receipt, ShoppingCart, Bot, Download, Menu, X, Shield
} from 'lucide-react'

const NAV = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ventas',     icon: ShoppingCart,     label: 'Ventas',      badge: 'NEW' },
  { to: '/catalogo',   icon: BookOpen,         label: 'Catálogo' },
  { to: '/recetas',    icon: ChefHat,          label: 'Recetas',     badge: 'CLAVE' },
  { to: '/costeo',     icon: Calculator,       label: 'Costeo' },
  { to: '/escalado',   icon: Scale,            label: 'Escalado' },
  { to: '/inventario', icon: Package,          label: 'Inventario' },
  { to: '/compras',    icon: Receipt,          label: 'Compras' },
  { to: '/ia',         icon: Bot,              label: 'Consultar IA' },
  { to: '/fiscal',     icon: Shield,           label: 'Config. Fiscal', badge: 'DGI' },
  { to: '/exportar',   icon: Download,         label: 'Exportar' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const currentPage = NAV.find(n => location.pathname.startsWith(n.to))?.label || 'Master Baker'

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
            <div className="text-[10px] text-gray-400 leading-tight">Gestión Inteligente de Panadería</div>
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
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="text-xs text-gray-400">v2.7 · Margen objetivo ≥57%</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button className="lg:hidden text-gray-500 hover:text-gray-700" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-semibold text-gray-900">{currentPage}</h1>
          <div className="ml-auto">
            <span className="text-xs px-2 py-1 rounded-md font-medium" style={{ background: '#EAF3DE', color: '#27500A' }}>
              Margen objetivo: ≥57%
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
