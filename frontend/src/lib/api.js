import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Tenant activo — fijo a Marquéz mientras no exista sistema de login.
// Cuando se agregue auth, esto se reemplaza por el tenant_id de la sesión.
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
    const msg = err.response?.data?.error || 'Error de conexión con el servidor'
    if (err.response?.status === 401) {
      localStorage.removeItem('marquez_token')
      window.location.href = '/login'
    } else if (err.response?.status !== 404) {
      toast.error(msg)
    }
    return Promise.reject(err)
  }
)

// ── Catálogo ─────────────────────────────────────────────────────────────────
export const getCatalogo = () => api.get('/catalogo')
export const updateProducto = (id, data) => api.put(`/catalogo/${id}`, data)

// ── Recetas ──────────────────────────────────────────────────────────────────
export const getRecetas = () => api.get('/recetas')
export const getReceta = (productoNombre) => api.get(`/recetas/${encodeURIComponent(productoNombre)}`)
export const saveReceta = (data) => api.post('/recetas', data)
export const updateReceta = (id, data) => api.put(`/recetas/${id}`, data)
export const deleteReceta = (id) => api.delete(`/recetas/${id}`)
export const importRecetasCSV = (filas) => api.post('/recetas/import-csv', { filas })

// ── Costeo ───────────────────────────────────────────────────────────────────
export const saveCosteo = (data) => api.post('/costeos', data)
export const getCosteos = (params) => api.get('/costeos', { params })

// ── Inventario ───────────────────────────────────────────────────────────────
export const getInventario = () => api.get('/inventario')
export const saveInsumo = (data) => api.post('/inventario', data)
export const updateInsumo = (id, data) => api.put(`/inventario/${id}`, data)
export const deleteInsumo = (id) => api.delete(`/inventario/${id}`)

// ── Compras ──────────────────────────────────────────────────────────────────
export const getCompras = () => api.get('/compras')
export const saveFactura = (data) => api.post('/compras', data)

// ── IA ───────────────────────────────────────────────────────────────────────
export const chatIA = (messages, context) => api.post('/ia/chat', { messages, context })

// ── Exportar ─────────────────────────────────────────────────────────────────
export const exportarReporte = (tipo) => api.get(`/exportar/${tipo}`, { responseType: 'blob' })

export const API = api
export default api

// ── Fiscal DGI ───────────────────────────────────────────────────────────────
export const getFiscalConfig  = ()     => api.get('/fiscal')
export const saveFiscalConfig = (data) => api.put('/fiscal', data)
export const getProrrateo     = (params) => api.get('/fiscal/prorrateo', { params })

// ── Ventas ───────────────────────────────────────────────────────────────────
export const getVentas       = (params) => api.get('/ventas', { params })
export const getVentaResumen = (fecha)  => api.get('/ventas/resumen', { params: { fecha } })
export const getVentaCierre  = (fecha)  => api.get('/ventas/cierre',  { params: { fecha } })
export const saveVenta       = (data)   => api.post('/ventas', data)
export const deleteVenta     = (id)     => api.delete(`/ventas/${id}`)
