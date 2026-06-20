import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Tenant activo â€” fijo a MarquÃ©z mientras no exista sistema de login.
// Cuando se agregue auth, esto se reemplaza por el tenant_id de la sesiÃ³n.
const TENANT_ID_ACTUAL = '00000000-0000-0000-0000-000000000001'

// Interceptor: adjunta JWT si existe, y el tenant activo en cada request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('marquez_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  config.headers['x-tenant-id'] = TENANT_ID_ACTUAL
  return config
})

// Interceptor: manejo global de errores
api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error || 'Error de conexiÃ³n con el servidor'
    if (err.response?.status === 401) {
      localStorage.removeItem('marquez_token')
      window.location.href = '/login'
    } else if (err.response?.status !== 404) {
      toast.error(msg)
    }
    return Promise.reject(err)
  }
)

// â”€â”€ CatÃ¡logo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Las funciones de escritura aceptan `pin` y lo mandan en el header
// x-admin-pin â€” el backend lo valida contra ADMIN_PIN antes de aplicar el cambio.
export const getCatalogo = () => api.get('/catalogo')
export const getAuditoriaProductos = (limit) => api.get('/catalogo/auditoria', { params: { limit } })
export const updateProducto = (id, data, pin) =>
  api.put(`/catalogo/${id}`, data, { headers: { 'x-admin-pin': pin } })
export const updateProductosMasivo = (productos, pin) =>
  api.put('/catalogo/masivo/lista', { productos }, { headers: { 'x-admin-pin': pin } })
export const updateProductosPorCategoria = (categoria, porcentaje, pin) =>
  api.put('/catalogo/masivo/categoria', { categoria, porcentaje }, { headers: { 'x-admin-pin': pin } })

// â”€â”€ Recetas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getRecetas = () => api.get('/recetas')
export const getReceta = (productoNombre) => api.get(`/recetas/${encodeURIComponent(productoNombre)}`)
export const saveReceta = (data) => api.post('/recetas', data)
export const updateReceta = (id, data) => api.put(`/recetas/${id}`, data)
export const deleteReceta = (id) => api.delete(`/recetas/${id}`)
export const importRecetasCSV = (filas) => api.post('/recetas/import-csv', { filas })

// â”€â”€ Costeo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const saveCosteo = (data) => api.post('/costeos', data)
export const getCosteos = (params) => api.get('/costeos', { params })

// â”€â”€ Inventario â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getInventario = () => api.get('/inventario')
export const getAuditoriaInsumos = (limit) => api.get('/inventario/auditoria', { params: { limit } })
export const saveInsumo = (data) => api.post('/inventario', data)
export const updateInsumo = (id, data, pin) =>
  api.put(`/inventario/${id}`, data, { headers: { 'x-admin-pin': pin } })
export const updateInsumosMasivo = (insumos, pin) =>
  api.put('/inventario/masivo/lista', { insumos }, { headers: { 'x-admin-pin': pin } })
export const updateInsumosPorcentaje = (porcentaje, pin) =>
  api.put('/inventario/masivo/porcentaje', { porcentaje }, { headers: { 'x-admin-pin': pin } })
export const deleteInsumo = (id) => api.delete(`/inventario/${id}`)

// â”€â”€ Compras â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getCompras = () => api.get('/compras')
export const saveFactura = (data) => api.post('/compras', data)

// â”€â”€ IA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const chatIA = (messages, context) => api.post('/ia/chat', { messages, context })

// â”€â”€ Exportar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const exportarReporte = (tipo) => api.get(`/exportar/${tipo}`, { responseType: 'blob' })

export default api

// â”€â”€ Fiscal DGI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getFiscalConfig  = ()     => api.get('/fiscal')
export const saveFiscalConfig = (data) => api.put('/fiscal', data)
export const getProrrateo     = (params) => api.get('/fiscal/prorrateo', { params })

// â”€â”€ Ventas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getVentas       = (params) => api.get('/ventas', { params })
export const getVentaResumen = (fecha)  => api.get('/ventas/resumen', { params: { fecha } })
export const getVentaCierre  = (fecha)  => api.get('/ventas/cierre',  { params: { fecha } })
export const saveVenta       = (data)   => api.post('/ventas', data)
export const deleteVenta     = (id)     => api.delete(`/ventas/${id}`)


// -- Usuarios (solo admin) ---------------------------------------------------
export const getUsuarios     = ()           => api.get('/auth/usuarios')
export const registrarUsuario = (data)      => api.post('/auth/registrar', data)
export const toggleUsuario   = (id, activo) => api.patch(`/auth/usuarios/${id}`, { activo })
