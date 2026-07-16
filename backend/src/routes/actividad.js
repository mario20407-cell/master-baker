import { Router } from 'express'
import { query } from '../db/client.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

// POST /api/actividad/heartbeat — el frontend llama esto cada 60s mientras
// la pestaña está visible y el usuario está logueado. Cada fila representa
// ~1 minuto de "tiempo en pantalla" activo, usado en el panel de fundadores.
router.post('/heartbeat', requireAuth, async (req, res, next) => {
  try {
    await query(
      'INSERT INTO actividad_heartbeats (tenant_id, usuario_id) VALUES ($1, $2)',
      [req.tenantId, req.usuarioId]
    )
    res.json({ ok: true })
  } catch (e) { next(e) }
})

export default router
