import api from './api.js'

export const getMiPlan       = ()       => api.get('/suscripciones/mi-plan')
export const getDatosPago    = ()       => api.get('/suscripciones/datos-pago')
export const subirComprobante = (data)  => api.post('/suscripciones/pago', data)
export const getPendientes   = ()       => api.get('/suscripciones/admin/pendientes')
export const aprobarPago     = (id, d)  => api.post(`/suscripciones/aprobar/${id}`, d)
export const rechazarPago    = (id, d)  => api.post(`/suscripciones/rechazar/${id}`, d)
