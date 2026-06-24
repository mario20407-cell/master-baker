import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"    element={<Dashboard />} />
        <Route path="catalogo"     element={<Catalogo />} />
        <Route path="recetas"      element={<Recetas />} />
        <Route path="costeo"       element={<Costeo />} />
        <Route path="escalado"     element={<Escalado />} />
        <Route path="inventario"   element={<Inventario />} />
        <Route path="compras"      element={<Compras />} />
        <Route path="ventas"       element={<Ventas />} />
        <Route path="ia"           element={<IAChat />} />
        <Route path="exportar"     element={<Exportar />} />
        <Route path="fiscal"       element={<ConfigFiscal />} />
        <Route path="ayuda"        element={<Ayuda />} />
      </Route>
    </Routes>
  )
}
