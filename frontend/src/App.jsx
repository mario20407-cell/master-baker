import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Registro from './pages/Registro'
import Dashboard from './pages/Dashboard'
import Catalogo from './pages/Catalogo'
import Recetas from './pages/Recetas'
import Costeo from './pages/Costeo'
import Escalado from './pages/Escalado'
import Inventario from './pages/Inventario'
import Compras from './pages/Compras'
import Ventas from './pages/Ventas'
import IAChat from './pages/IAChat'
import Exportar from './pages/Exportar'
import ConfigFiscal from './pages/ConfigFiscal'
import Ayuda from './pages/Ayuda'
import Produccion from './pages/Produccion'
import CajaProduccion from './pages/CajaProduccion'
import InventarioTerminado from './pages/InventarioTerminado'
import Reportes from './pages/Reportes'
import Equipo from './pages/Equipo'
import MiCuenta from './pages/MiCuenta'

// Ruta protegida: redirige a /login si no hay sesión activa
function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF8F4' }}>
      <div className="text-center">
        <div className="text-3xl mb-3">🥐</div>
        <p className="text-sm text-gray-400">Cargando...</p>
      </div>
    </div>
  )
  if (!usuario) return <Navigate to="/login" replace />
  return children
}

// Ruta protegida por rol o permiso
function RutaPorPermiso({ children, permission, role }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return null

  if (!usuario) return <Navigate to="/login" replace />
  if (usuario.rol === 'admin') return children

  if (role && usuario.rol !== role) {
    return <Navigate to="/dashboard" replace />
  }

  if (permission && (!usuario.permisos || !usuario.permisos.includes(permission))) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default function App() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />

      {/* Rutas protegidas */}
      <Route path="/" element={
        <RutaProtegida>
          <Layout />
        </RutaProtegida>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"    element={<Dashboard />} />
        <Route path="catalogo"     element={<RutaPorPermiso permission="ver_catalogo"><Catalogo /></RutaPorPermiso>} />
        <Route path="recetas"      element={<RutaPorPermiso permission="ver_recetas"><Recetas /></RutaPorPermiso>} />
        <Route path="costeo"       element={<RutaPorPermiso permission="ver_costeo"><Costeo /></RutaPorPermiso>} />
        <Route path="escalado"     element={<RutaPorPermiso permission="ver_recetas"><Escalado /></RutaPorPermiso>} />
        <Route path="inventario"   element={<RutaPorPermiso permission="ver_inventario"><Inventario /></RutaPorPermiso>} />
        <Route path="compras"      element={<RutaPorPermiso permission="ver_compras"><Compras /></RutaPorPermiso>} />
        <Route path="ventas"       element={<RutaPorPermiso permission="registrar_ventas"><Ventas /></RutaPorPermiso>} />
        <Route path="produccion"   element={<RutaPorPermiso permission="ver_produccion"><Produccion /></RutaPorPermiso>} />
        <Route path="lotes"        element={<RutaPorPermiso permission="ver_produccion"><CajaProduccion /></RutaPorPermiso>} />
        <Route path="sucursales"   element={<RutaPorPermiso permission="ver_produccion"><InventarioTerminado /></RutaPorPermiso>} />
        <Route path="reportes"     element={<RutaPorPermiso role="admin"><Reportes /></RutaPorPermiso>} />
        <Route path="ia"           element={<IAChat />} />
        <Route path="exportar"     element={<RutaPorPermiso role="admin"><Exportar /></RutaPorPermiso>} />
        <Route path="fiscal"       element={<RutaPorPermiso role="admin"><ConfigFiscal /></RutaPorPermiso>} />
        <Route path="ayuda"        element={<Ayuda />} />
        <Route path="equipo"       element={<RutaPorPermiso role="admin"><Equipo /></RutaPorPermiso>} />
        <Route path="mi-cuenta"    element={<MiCuenta />} />
      </Route>
    </Routes>
  )
}
