import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import app from '../index.js'

// Mock de base de datos para evitar llamadas reales en los tests
vi.mock('../db/client.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  transaction: vi.fn().mockResolvedValue({}),
}))

const SECURED_ENDPOINTS = [
  // 1. Recetas
  { method: 'get', path: '/api/recetas' },
  { method: 'post', path: '/api/recetas' },
  { method: 'put', path: '/api/recetas/1' },
  { method: 'delete', path: '/api/recetas/1' },
  
  // 2. Costeos
  { method: 'get', path: '/api/costeos' },
  { method: 'post', path: '/api/costeos' },
  
  // 3. Lotes
  { method: 'get', path: '/api/lotes' },
  { method: 'post', path: '/api/lotes' },
  
  // 4. Sucursales
  { method: 'get', path: '/api/sucursales' },
  
  // 5. Inventario Terminado (Stock)
  { method: 'get', path: '/api/inventario-terminado' },
  
  // 6. Inventario (Insumos)
  { method: 'get', path: '/api/inventario' },
  { method: 'post', path: '/api/inventario' },
  { method: 'put', path: '/api/inventario/1' },
  { method: 'delete', path: '/api/inventario/1' },
  
  // 7. Compras
  { method: 'get', path: '/api/compras' },
  { method: 'post', path: '/api/compras' },
  
  // 8. Fiscal
  { method: 'get', path: '/api/fiscal' },
  { method: 'put', path: '/api/fiscal' },
  
  // 9. Usuarios (Gestión)
  { method: 'get', path: '/api/usuarios' },
  { method: 'post', path: '/api/usuarios' },
  { method: 'patch', path: '/api/usuarios/tenant-config' },
  { method: 'patch', path: '/api/usuarios/1' },
  
  // 10. WhatsApp (Dash/Control)
  { method: 'get', path: '/api/whatsapp/status' },
  { method: 'post', path: '/api/whatsapp/enviar' },
  { method: 'get', path: '/api/whatsapp/conversacion/123' },
  { method: 'delete', path: '/api/whatsapp/conversacion/123' }
]

describe('🔒 Verificación Global de Seguridad: Retorno 401 Sin Token', () => {
  it.each(SECURED_ENDPOINTS)('debe denegar acceso con 401 en $method $path', async ({ method, path }) => {
    const res = await request(app)[method](path)
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/se requiere autenticacion/i)
  })
})
