import { query } from '../db/client.js'

/**
 * Registra una acción de auditoría en la tabla bitacora_actividades.
 * 
 * @param {Object} req - Objeto de petición Express (contiene req.tenantId, req.usuarioId, req.nombre, req.email, req.ip)
 * @param {Object} params
 * @param {string} params.modulo - Módulo afectado (ej. 'recetas', 'inventario', 'ventas', 'seguridad', 'catalogo', 'compras')
 * @param {string} params.accion - Acción corta en mayúsculas (ej. 'REGISTRAR_VENTA', 'AJUSTAR_STOCK', 'CREAR_RECETA')
 * @param {string} params.descripcion - Mensaje amigable describiendo la acción
 * @param {Object} [params.detalles] - Información técnica o valores adicionales (JSON)
 */
export async function registrarActividad(req, { modulo, accion, descripcion, detalles = {} }) {
  if (!req.tenantId || !req.usuarioId) {
    // Si no está autenticado, no podemos registrar el usuario, omitimos o registramos como anónimo
    return
  }

  try {
    await query(`
      INSERT INTO bitacora_actividades 
        (tenant_id, usuario_id, usuario_nombre, usuario_email, modulo, accion, descripcion, detalles, ip_origen)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      req.tenantId,
      req.usuarioId,
      req.nombre || 'Sin nombre',
      req.email || 'sin-email',
      modulo,
      accion,
      descripcion,
      JSON.stringify(detalles),
      req.ip || null
    ])
  } catch (err) {
    console.error('[Bitácora] Error al escribir actividad en base de datos:', err.message)
  }
}
