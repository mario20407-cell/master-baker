import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, BookOpen, ChefHat, Calculator, Scale,
  Package, Receipt, ShoppingCart, Bot, Download, Menu, X, Shield, HelpCircle,
  Sun, Moon, ChevronLeft, ChevronRight, TrendingUp, Users, Layers, Store, FileText
} from 'lucide-react'

const NAV_GROUPS = [
  {
    title: 'Operación',
    items: [
      { to: '/ventas',     icon: ShoppingCart,     label: 'Ventas',      badge: 'NEW', permission: 'ver_ventas' },
      { to: '/inventario', icon: Package,          label: 'Inventario', permission: 'ver_inventario' },
      { to: '/compras',    icon: Receipt,          label: 'Compras', permission: 'ver_compras' },
    ]
  },
  {
    title: 'Producción',
    items: [
      { to: '/recetas',    icon: ChefHat,          label: 'Recetas',     badge: 'CLAVE', permission: 'ver_recetas' },
      { to: '/produccion', icon: TrendingUp,       label: 'Producción',  badge: 'NEW', permission: 'ver_produccion' },
      { to: '/lotes',      icon: Layers,           label: 'Producto Terminado', permission: 'ver_produccion' },
      { to: '/sucursales', icon: Store,            label: 'Sucursales', permission: 'ver_produccion' },
      { to: '/costeo',     icon: Calculator,       label: 'Costeo', permission: 'ver_costeo' },
      { to: '/escalado',   icon: Scale,            label: 'Escalado', permission: 'ver_recetas' },
    ]
  },
  {
    title: 'Herramientas',
    items: [
      { to: '/dashboard',  icon: LayoutDashboard,  label: 'Dashboard' },
      { to: '/catalogo',   icon: BookOpen,         label: 'Catálogo', permission: 'ver_catalogo' },
      { to: '/ia',         icon: Bot,              label: 'Consultar IA' },
      { to: '/fiscal',     icon: Shield,           label: 'Config. Fiscal', badge: 'DGI', role: 'admin' },
      { to: '/equipo',     icon: Users,            label: 'Mi Equipo', role: 'admin' },
      { to: '/ayuda',      icon: HelpCircle,       label: 'Ayuda' },
      { to: '/reportes',   icon: FileText,         label: 'Reportes', role: 'admin' },
      { to: '/exportar',   icon: Download,         label: 'Exportar', role: 'admin' },
    ]
  }
]

// List representation for locating the current page label
const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items)

export default function Layout() {
  const { usuario } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_collapsed') === 'true'
    }
    return false
  })
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    }
    return 'light'
  })

  const location = useLocation()
  
  const filteredNavGroups = NAV_GROUPS.map(group => {
    const items = group.items.filter(item => {
      if (!usuario) return false
      if (usuario.rol === 'admin') return true
      if (item.role && usuario.rol !== item.role) return false
      if (item.permission) {
        return usuario.permisos && usuario.permisos.includes(item.permission)
      }
      return true
    })
    return { ...group, items }
  }).filter(group => group.items.length > 0)

  const currentPage = ALL_ITEMS.find(n => location.pathname.startsWith(n.to))?.label || 'Master Baker'

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleSidebarCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-navy-950 overflow-hidden text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 bg-white dark:bg-navy-900 border-r border-gray-100 dark:border-navy-800 flex flex-col transition-all duration-200 lg:translate-x-0 ${isCollapsed ? 'w-16' : 'w-56'} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Sidebar Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-navy-800 min-h-[73px]">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#263D4F' }}>
            <img src="/branding/logo-emblema.png" alt="Master Baker" className="w-7 h-7 object-contain" />
          </div>
          {!isCollapsed && (
            <div className="transition-opacity duration-150">
              <div className="text-sm font-semibold leading-tight tracking-wide" style={{ color: '#C29C53' }}>MASTER BAKER</div>
              <div className="text-[9px] text-gray-400 dark:text-gray-500 leading-tight">Gestión Panadería</div>
            </div>
          )}
          <button className="ml-auto lg:hidden text-gray-400" onClick={() => setSidebarOpen(false)}>
            <X size={16} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {filteredNavGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {!isCollapsed && (
                <h3 className="px-3 text-[10px] font-bold text-gray-400 dark:text-navy-400 uppercase tracking-wider mb-2">
                  {group.title}
                </h3>
              )}
              {group.items.map(({ to, icon: Icon, label, badge }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setSidebarOpen(false)}
                  title={isCollapsed ? label : ''}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors whitespace-nowrap
                    ${isActive 
                      ? 'bg-brand-400 text-white hover:bg-brand-600 font-medium' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800'
                    }
                    ${isCollapsed ? 'justify-center px-0' : ''}
                  `}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!isCollapsed && <span className="flex-1 text-xs">{label}</span>}
                  {!isCollapsed && badge && (
                    <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: badge === 'NEW' ? '#3B6D11' : badge === 'DGI' ? '#263D4F' : '#C29C53',
                        color: '#fff'
                      }}>
                      {badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-navy-800 flex items-center justify-between">
          {!isCollapsed && <span className="text-[10px] text-gray-400">v2.7.2</span>}
          <button 
            onClick={toggleSidebarCollapse}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-navy-800 ml-auto"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Header */}
        <header className="bg-white dark:bg-navy-900 border-b border-gray-100 dark:border-navy-800 px-4 py-3 flex items-center justify-between flex-shrink-0 transition-colors duration-200">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <h1 className="text-sm font-semibold text-gray-850 dark:text-gray-100">{currentPage}</h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex text-[11px] px-2.5 py-1 rounded-md font-medium" style={{ background: '#EAF3DE', color: '#27500A' }}>
              Margen objetivo: ≥57%
            </span>

            {/* Dark Mode Switcher */}
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-navy-800 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors"
              title="Alternar tema"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-navy-950 transition-colors duration-200">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
