// backend/src/routes/__tests__/sucursal-stock.test.js
import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { query } from '../../db/client.js'

// Importamos los routers a testear
import ventasRouter from '../ventas.js'
import produccionRouter from '../produccion.js'

const testTenantId = '66666666-6666-6666-6666-666666666666'
const testUsuarioId = '77777777-7777-7777-7777-777777777777'

let tokenAdmin = ''
let sucursalId = ''

function crearApp() {
  const app = express()
  app.use(express.json())
  
  // Injectamos propiedades que normalmente asignaría el middleware anterior o requireAuth
  // en caso de que alguna ruta las use directamente. Pero usaremos requireAuth real pasando el token.
  app.use((req, res, next) => {
    // Middleware inyector de prueba por si requireAuth se mockea, pero lo usaremos real
    next()
  })

  app.use('/api/ventas', ventasRouter)
  app.use('/api/produccion', produccionRouter)

  // Manejo de errores simplificado
  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' })
  })
  return app
}

const app = crearApp()

beforeAll(async () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no configurado en variables de entorno')
  }

  // Firmar token JWT real usando el JWT_SECRET
  tokenAdmin = jwt.sign(
    {
      usuarioId: testUsuarioId,
      tenantId: testTenantId,
      rol: 'admin',
      email: 'test-antigravity@marquez.com',
      nombre: 'Test Antigravity Admin'
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )

  // Crear el tenant de prueba
  await query(
    `INSERT INTO tenants (id, slug, nombre_negocio, pais, moneda, margen_objetivo, activo, plan)
     VALUES ($1, 'test-tenant-antigravity', 'Test Tenant Antigravity', 'Nicaragua', 'C$', '57.00', true, 'trial')
     ON CONFLICT (id) DO NOTHING`,
    [testTenantId]
  )

  // Crear la sucursal de prueba en la base de datos de staging
  const { rows: [sucursal] } = await query(
    `INSERT INTO sucursales (id, tenant_id, nombre, direccion, activo)
     VALUES (gen_random_uuid(), $1, 'Sucursal de Pruebas Antigravity', 'Direccion Test', true)
     RETURNING id`,
    [testTenantId]
  )
  sucursalId = sucursal.id
})

afterAll(async () => {
  console.log('[Cleanup] Iniciando limpieza secuencial para el tenant:', testTenantId)
  
  // Orden exacto de borrado seguro (hijos primero, padres después)
  await query('DELETE FROM venta_items WHERE tenant_id = $1', [testTenantId])
  await query('DELETE FROM ventas WHERE tenant_id = $1', [testTenantId])
  await query('DELETE FROM lote_distribuciones WHERE tenant_id = $1', [testTenantId])
  await query('DELETE FROM caja_produccion WHERE tenant_id = $1', [testTenantId])
  await query('DELETE FROM lotes WHERE tenant_id = $1', [testTenantId])
  await query('DELETE FROM ordenes_produccion WHERE tenant_id = $1', [testTenantId])
  await query('DELETE FROM inventario_terminado WHERE tenant_id = $1', [testTenantId])
  await query('DELETE FROM sugerencias_produccion WHERE tenant_id = $1', [testTenantId])
  await query('DELETE FROM ingredientes WHERE receta_id IN (SELECT id FROM recetas WHERE tenant_id = $1)', [testTenantId])
  await query('DELETE FROM recetas WHERE tenant_id = $1', [testTenantId])
  await query('DELETE FROM productos WHERE tenant_id = $1', [testTenantId])
  await query('DELETE FROM inventario WHERE tenant_id = $1', [testTenantId])
  await query('DELETE FROM sucursales WHERE tenant_id = $1', [testTenantId])
  await query('DELETE FROM tenants WHERE id = $1', [testTenantId])

  console.log('[Cleanup] Limpieza completada con éxito.')
})

describe('Tests de Integración - Sucursal y Stock', () => {

  it('POST /api/ventas con sucursal_id descuenta stock correcto y tolera productos sin inventario', async () => {
    // 1. Registrar producto de prueba en el inventario terminado de la sucursal con stock inicial
    const productoConInventario = 'Pan de Molde Test'
    const stockInicial = 50
    const stockMinimo = 10
    
    await query(
      `INSERT INTO inventario_terminado (id, tenant_id, sucursal_id, producto, stock, stock_minimo, unidad)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'unidad')`,
      [testTenantId, sucursalId, productoConInventario, stockInicial, stockMinimo]
    )

    // 2. Realizar venta del producto con inventario (10 unidades) y de uno inexistente (5 unidades)
    const itemsVenta = [
      { producto: productoConInventario, cantidad: 10, precio_unit: 15 },
      { producto: 'Producto Inexistente Test', cantidad: 5, precio_unit: 20 }
    ]
    const totalVenta = (10 * 15) + (5 * 20)

    const res = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        items: itemsVenta,
        total: totalVenta,
        metodo_pago: 'efectivo',
        canal: 'tienda',
        cliente: 'Cliente Test',
        sucursal_id: sucursalId
      })

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()

    // 3. Confirmar que el stock del producto registrado bajó a 40
    const { rows: [invActualizado] } = await query(
      `SELECT stock FROM inventario_terminado WHERE tenant_id = $1 AND sucursal_id = $2 AND producto = $3`,
      [testTenantId, sucursalId, productoConInventario]
    )
    expect(invActualizado.stock).toBe(40)
  })

  it('Dos ventas seguidas cruzando stock_minimo crean una única sugerencia_produccion sin duplicar', async () => {
    const productoConSugerencia = 'Baguette Test'
    const stockInicial = 15
    const stockMinimo = 10

    await query(
      `INSERT INTO inventario_terminado (id, tenant_id, sucursal_id, producto, stock, stock_minimo, unidad)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'unidad')`,
      [testTenantId, sucursalId, productoConSugerencia, stockInicial, stockMinimo]
    )

    // Venta 1: Descuenta 7 unidades (Stock baja a 8, cruza el stock mínimo de 10)
    const res1 = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        items: [{ producto: productoConSugerencia, cantidad: 7, precio_unit: 10 }],
        total: 70,
        metodo_pago: 'efectivo',
        canal: 'tienda',
        cliente: 'Cliente Venta 1',
        sucursal_id: sucursalId
      })
    expect(res1.status).toBe(201)

    // Verificar que se creó una sugerencia de producción
    const { rows: sugerenciasV1 } = await query(
      `SELECT id FROM sugerencias_produccion WHERE tenant_id = $1 AND sucursal_id = $2 AND producto = $3 AND atendida = false`,
      [testTenantId, sucursalId, productoConSugerencia]
    )
    expect(sugerenciasV1.length).toBe(1)

    // Venta 2: Descuenta 3 unidades más (Stock baja a 5, ya estaba por debajo del mínimo)
    const res2 = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        items: [{ producto: productoConSugerencia, cantidad: 3, precio_unit: 10 }],
        total: 30,
        metodo_pago: 'efectivo',
        canal: 'tienda',
        cliente: 'Cliente Venta 2',
        sucursal_id: sucursalId
      })
    expect(res2.status).toBe(201)

    // Confirmar que no hay duplicados (sigue existiendo exactamente 1 sugerencia)
    const { rows: sugerenciasV2 } = await query(
      `SELECT id FROM sugerencias_produccion WHERE tenant_id = $1 AND sucursal_id = $2 AND producto = $3 AND atendida = false`,
      [testTenantId, sucursalId, productoConSugerencia]
    )
    expect(sugerenciasV2.length).toBe(1)
  })

  it('POST /api/produccion con distribución genera consistencia entre lotes e inventario_terminado', async () => {
    // 1. Para producir necesitamos que el producto exista en catalogo/productos y luego una receta
    const productoProducido = 'Donas Azucaradas Test'
    await query(
      `INSERT INTO productos (id, tenant_id, nombre, precio, presentacion, categoria, activo)
       VALUES (gen_random_uuid(), $1, $2, 10.00, 'unidad', 'Repostería', true)`,
      [testTenantId, productoProducido]
    )

    const { rows: [receta] } = await query(
      `INSERT INTO recetas (id, tenant_id, producto, piezas, merma_pct)
       VALUES (gen_random_uuid(), $1, $2, 10, 0) RETURNING id`,
      [testTenantId, productoProducido]
    )

    // Ingrediente de la receta para que valide bien
    await query(
      `INSERT INTO ingredientes (id, receta_id, nombre, cantidad, unidad, tipo, tenant_id)
       VALUES (gen_random_uuid(), $1, 'Harina Test', 100, 'g', 'directo', $2)`,
      [receta.id, testTenantId]
    )

    // Agregar harina al inventario del tenant de prueba para que no de stock insuficiente
    await query(
      `INSERT INTO inventario (id, tenant_id, nombre, existencia, unidad)
       VALUES (gen_random_uuid(), $1, 'Harina Test', 1000, 'g')`,
      [testTenantId]
    )

    // 2. Ejecutar POST /api/produccion con distribución a nuestra sucursal
    const res = await request(app)
      .post('/api/produccion')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        producto: productoProducido,
        piezas: 10,
        forzar: false,
        distribuciones: [
          { sucursal_id: sucursalId, cantidad: 10 }
        ]
      })

    expect(res.status).toBe(201)
    expect(res.body.lote).toBeDefined()
    expect(res.body.distribuciones).toBeDefined()
    
    const loteId = res.body.lote.id

    // 3. Confirmar que se creó la distribución correcta del lote
    const { rows: [distribucion] } = await query(
      `SELECT cantidad FROM lote_distribuciones WHERE tenant_id = $1 AND lote_id = $2 AND sucursal_id = $3`,
      [testTenantId, loteId, sucursalId]
    )
    expect(distribucion.cantidad).toBe(10)

    // 4. Confirmar que el stock en inventario_terminado se actualizó consistentemente
    const { rows: [inventario] } = await query(
      `SELECT stock FROM inventario_terminado WHERE tenant_id = $1 AND sucursal_id = $2 AND producto = $3`,
      [testTenantId, sucursalId, productoProducido]
    )
    expect(inventario.stock).toBe(10)
  })

})
