import { useState, useEffect } from 'react'
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom'
import {
  FileText, LayoutDashboard, BookOpen, ChefHat, Calculator, Scale,
  Package, Receipt, ShoppingCart, Bot, Download, Menu, X, Shield, HelpCircle, Moon, Sun, Factory, Users
} from 'lucide-react'

const NAV = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ventas',     icon: ShoppingCart,     label: 'Ventas',      badge: 'NEW' },
  { to: '/catalogo',   icon: BookOpen,         label: 'Catálogo' },
  { to: '/recetas',    icon: ChefHat,          label: 'Recetas',     badge: 'CLAVE' },
  { to: '/costeo',     icon: Calculator,       label: 'Costeo' },
  { to: '/escalado',   icon: Scale,            label: 'Escalado' },
  { to: '/inventario', icon: Package,          label: 'Inventario' },
  { to: '/produccion', icon: Factory,           label: 'Producción',  badge: 'NEW' },
  { to: '/compras',    icon: Receipt,          label: 'Compras' },
  { to: '/reportes', icon: FileText, label: 'Reportes' },
  { to: '/ia',         icon: Bot,              label: 'Consultar IA' },
  { to: '/fiscal',     icon: Shield,           label: 'Config. Fiscal', badge: 'DGI' },
  { to: '/usuarios',   icon: Users,            label: 'Usuarios' },
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
            <img src="/branding/logo-completo.png" alt="Master Baker" className="w-full h-32 object-contain" />
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
          <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>v3.2 � Margen objetivo =57%</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="border-b px-4 py-3 flex items-center gap-3 flex-shrink-0" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <button className="lg:hidden text-gray-500 hover:text-gray-700" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex flex-col items-center flex-1"><span className="text-sm font-bold tracking-widest uppercase" style={{ color: '#263D4F' }}>Master Baker</span><span className="text-xs tracking-wider" style={{ color: '#C29C53' }}>Sistema de Gestión Inteligente de Panadería</span><span className="text-[9px] tracking-wider" style={{ color: '#888' }}>Cliente activo: Marquéz Panadería &amp; Repostería</span></div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-md font-medium" style={{ background: '#EAF3DE', color: '#27500A' }}>
              Margen objetivo: =57%
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










