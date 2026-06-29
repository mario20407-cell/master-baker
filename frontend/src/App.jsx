import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
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
import Usuarios from './pages/Usuarios'
import ConfigFiscal from './pages/ConfigFiscal'
import CajaProduccion from './pages/CajaProduccion'
import InventarioTerminado from './pages/InventarioTerminado'

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

function SoloAdmin({ children }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return null
  if (!usuario || usuario.rol !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <RutaProtegida>
          <Layout />
        </RutaProtegida>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"  element={<Dashboard />} />
        <Route path="catalogo"   element={<Catalogo />} />
        <Route path="recetas"    element={<Recetas />} />
        <Route path="costeo"     element={<Costeo />} />
        <Route path="escalado"   element={<Escalado />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="compras"    element={<Compras />} />
        <Route path="ventas"     element={<Ventas />} />
        <Route path="ia"         element={<IAChat />} />
        <Route path="exportar"      element={<Exportar />} />
        <Route path="caja"              element={<CajaProduccion />} />
        <Route path="stock"             element={<InventarioTerminado />} />
        <Route path="fiscal"     element={<SoloAdmin><ConfigFiscal /></SoloAdmin>} />
        <Route path="usuarios"   element={<SoloAdmin><Usuarios /></SoloAdmin>} />
      </Route>
    </Routes>
  )
}
