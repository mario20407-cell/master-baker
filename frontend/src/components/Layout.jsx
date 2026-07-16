import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import {
  LayoutDashboard, BookOpen, ChefHat, Calculator, Scale,
  Package, Receipt, ShoppingCart, Bot, Download, Menu, X, Shield, HelpCircle,
  Sun, Moon, ChevronDown, TrendingUp, Users, Layers, Store, FileText, LogOut, KeyRound
} from 'lucide-react'

const NAV_GROUPS = [
  {
    title: 'Operación',
    items: [
      { to: '/ventas',     icon: ShoppingCart,     label: 'Ventas',      badge: 'NEW', permission: 'registrar_ventas' },
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
      { to: '/mi-cuenta',  icon: KeyRound,         label: 'Mi Cuenta' },
      { to: '/ayuda',      icon: HelpCircle,       label: 'Ayuda' },
      { to: '/reportes',   icon: FileText,         label: 'Reportes', role: 'admin' },
      { to: '/exportar',   icon: Download,         label: 'Exportar', role: 'admin' },
    ]
  }
]

const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items)

export default function Layout() {
  const { usuario, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    }
    return 'light'
  })

  const location = useLocation()
  const currentPage = ALL_ITEMS.find(n => location.pathname.startsWith(n.to))?.label || 'Master Baker'

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

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  // "Tiempo en pantalla" para el panel de fundadores — un heartbeat cada
  // 60s mientras haya sesión y la pestaña esté visible. Cada fila en
  // actividad_heartbeats representa ~1 minuto de uso activo del tenant.
  // Usa axios "pelado" (no la instancia `api` de lib/api.js) a propósito:
  // esto es telemetría de fondo y nunca debe mostrar un toast de error ni,
  // peor, forzar un logout si un heartbeat puntual falla — cosa que sí
  // haría el interceptor global de `api` ante cualquier 401/error de red.
  useEffect(() => {
    if (!usuario) return
    const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
    const enviarHeartbeat = () => {
      if (document.visibilityState !== 'visible') return
      const token = localStorage.getItem('marquez_token')
      if (!token) return
      axios.post(API + '/actividad/heartbeat', {}, {
        headers: { Authorization: 'Bearer ' + token }
      }).catch(() => {})
    }
    enviarHeartbeat()
    const intervalo = setInterval(enviarHeartbeat, 60000)
    return () => clearInterval(intervalo)
  }, [usuario])

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-navy-950 overflow-hidden text-gray-900 dark:text-gray-100 transition-colors duration-200">

      {/* Top Navbar */}
      <header className="bg-white dark:bg-navy-900 border-b border-gray-100 dark:border-navy-800 px-6 py-3.5 flex items-center justify-between flex-shrink-0 transition-colors duration-200 z-40 relative">
        <div className="flex items-center gap-6">
          {/* Mobile Hamburger menu Button */}
          <button className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>

          {/* Logo & Brand Branding */}
          <Link to="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity cursor-pointer">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#263D4F' }}>
              <img src="/branding/logo-emblema.png" alt="Master Baker" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <div className="text-xs font-semibold leading-tight tracking-wide" style={{ color: '#C29C53' }}>MASTER BAKER</div>
              <div className="text-[8px] text-gray-400 dark:text-gray-500 leading-tight">Gestión Panadería</div>
            </div>
          </Link>

          {/* Desktop Cascading Navigation Bar */}
          <nav className="hidden lg:flex items-center gap-1 ml-4">
            {filteredNavGroups.map((group, idx) => (
              <div key={idx} className="relative group px-2 py-1">
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-gray-50 dark:hover:bg-navy-800 transition-all cursor-pointer">
                  {group.title}
                  <ChevronDown size={12} className="text-gray-400 group-hover:text-brand-500 transition-transform duration-200 group-hover:rotate-180" />
                </button>

                {/* Cascade Dropdown Card */}
                <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-navy-900 border border-gray-100 dark:border-navy-800 rounded-xl shadow-xl py-1.5 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0">
                  {group.items.map(({ to, icon: Icon, label, badge }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-4 py-2 text-xs transition-colors hover:bg-gray-50 dark:hover:bg-navy-800
                        ${isActive
                          ? 'text-brand-600 dark:text-brand-400 font-semibold bg-amber-50/50 dark:bg-navy-800/50'
                          : 'text-gray-600 dark:text-gray-300'
                        }
                      `}
                    >
                      <Icon size={14} className="text-gray-400" />
                      <span className="flex-1">{label}</span>
                      {badge && (
                        <span className="text-[7px] font-extrabold px-1.5 py-0.5 rounded-full text-white"
                          style={{
                            background: badge === 'NEW' ? '#3B6D11' : badge === 'DGI' ? '#263D4F' : '#C29C53',
                          }}>
                          {badge}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Right Header Panel */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex text-[10px] px-2.5 py-1 rounded-md font-medium" style={{ background: '#EAF3DE', color: '#27500A' }}>
            Margen objetivo: ≥57%
          </span>

          {/* Theme switcher */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-navy-800 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors cursor-pointer"
            title="Alternar tema"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* User dropdown */}
          {usuario && (
            <div className="relative group px-1 py-1">
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-gray-50 dark:hover:bg-navy-800 transition-all cursor-pointer"
                onClick={() => setUserMenuOpen(o => !o)}
              >
                {usuario.nombre || usuario.email}
                <ChevronDown size={12} className="text-gray-400 group-hover:text-brand-500 transition-transform duration-200 group-hover:rotate-180" />
              </button>

              <div className={`absolute right-0 mt-1 w-44 bg-white dark:bg-navy-900 border border-gray-100 dark:border-navy-800 rounded-xl shadow-xl py-1.5 z-50 transition-all duration-200 transform
                opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0
                ${userMenuOpen ? 'opacity-100 visible translate-y-0' : ''}`}
              >
                <div className="px-4 py-2 text-[10px] text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-navy-800">
                  {usuario.rol}
                </div>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >
                  <LogOut size={14} />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Drawer (visible only on mobile when sidebarOpen is true) */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-45 lg:hidden animate-fade-in" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-navy-900 border-r border-gray-100 dark:border-navy-800 z-50 flex flex-col transition-transform duration-250 lg:hidden">
            {/* Sidebar Mobile Header */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-navy-800 min-h-[63px]">
              <Link to="/dashboard" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 hover:opacity-90 transition-opacity cursor-pointer">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#263D4F' }}>
                  <img src="/branding/logo-emblema.png" alt="Master Baker" className="w-6 h-6 object-contain" />
                </div>
                <div>
                  <div className="text-xs font-semibold leading-tight tracking-wide" style={{ color: '#C29C53' }}>MASTER BAKER</div>
                  <div className="text-[8px] text-gray-400 dark:text-gray-500 leading-tight">Gestión Panadería</div>
                </div>
              </Link>
              <button className="ml-auto text-gray-400" onClick={() => setSidebarOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Sidebar Mobile Nav */}
            <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
              {filteredNavGroups.map((group, groupIdx) => (
                <div key={groupIdx} className="space-y-1">
                  <h3 className="px-3 text-[9px] font-bold text-gray-400 dark:text-navy-400 uppercase tracking-wider mb-2">
                    {group.title}
                  </h3>
                  {group.items.map(({ to, icon: Icon, label, badge }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors whitespace-nowrap
                        ${isActive
                          ? 'bg-brand-400 text-white font-medium shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800'
                        }
                      `}
                    >
                      <Icon size={15} />
                      <span className="flex-1">{label}</span>
                      {badge && (
                        <span className="text-[7px] font-extrabold px-1.5 py-0.5 rounded-full text-white"
                          style={{
                            background: badge === 'NEW' ? '#3B6D11' : badge === 'DGI' ? '#263D4F' : '#C29C53',
                          }}>
                          {badge}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-100 dark:border-navy-800">
              {usuario && (
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 text-xs font-medium text-red-500 hover:text-red-600 transition-colors py-1.5 px-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 mb-2"
                >
                  <LogOut size={14} />
                  Cerrar sesión
                </button>
              )}
              <div className="text-[10px] text-gray-455 dark:text-navy-500">
                v2.7.2
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Page Indicator */}
        <div className="lg:hidden bg-white dark:bg-navy-900 border-b border-gray-100 dark:border-navy-850 px-6 py-2.5 text-xs font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 transition-colors duration-200">
          📍 {currentPage}
        </div>

        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-navy-950 transition-colors duration-200">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
