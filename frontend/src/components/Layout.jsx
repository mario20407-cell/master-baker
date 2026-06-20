import { useState, useEffect } from 'react'
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, ChefHat, Calculator, Scale,
  Package, Receipt, ShoppingCart, Bot, Download, Menu, X, Shield, HelpCircle, Moon, Sun
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
  { to: '/ayuda',      icon: HelpCircle,       label: 'Ayuda' },
  { to: '/exportar',   icon: Download,         label: 'Exportar' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true')
  const location = useLocation()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('darkMode', darkMode)
  }, [darkMode])
  const currentPage = NAV.find(n => location.pathname.startsWith(n.to))?.label || 'Master Baker'

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-56 border-r flex flex-col transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <Link to="/dashboard" className="flex items-center gap-3 flex-1 min-w-0" onClick={() => setSidebarOpen(false)}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#263D4F' }}>
              <img src="/branding/logo-emblema.png" alt="Master Baker" className="w-9 h-9 object-contain" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight tracking-wide" style={{ color: '#263D4F' }}>MASTER BAKER</div>
              <div className="text-[10px] text-gray-400 leading-tight">Gestión Inteligente de Panadería</div>
            </div>
          </Link>
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
        <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>v3.2 · Margen objetivo ≥57%</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="border-b px-4 py-3 flex items-center gap-3 flex-shrink-0" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <button className="lg:hidden text-gray-500 hover:text-gray-700" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{currentPage}</h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-md font-medium" style={{ background: '#EAF3DE', color: '#27500A' }}>
              Margen objetivo: ≥57%
            </span>
            <button
              onClick={() => setDarkMode(d => !d)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}
              title={darkMode ? 'Modo claro' : 'Modo oscuro'}>
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
