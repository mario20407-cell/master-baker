// backend/src/routes/__tests__/recetas.costo-cero.test.js
//
// Test aislado de la validación "costo cero intencional" en POST/PUT /api/recetas.
// No usa una DB real ni levanta backend/src/index.js (eso dispararía app.listen()
// y una query de arranque contra la DB configurada). En vez de eso, monta un
// Express mínimo con solo el router de recetas, y mockea la capa de DB
// (db/client.js) para que cualquier llamada después de la validación no falle.

process.env.JWT_SECRET = 'test-secret'

import { describe, it, expect, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// db/client.js es importado tanto por recetas.js como por bitacoraService.js —
// mockear el módulo una sola vez cubre ambos casos. Las llamadas después de la
// validación de costo cero no necesitan datos realistas, solo no explotar.
vi.mock('../../db/client.js', () => {
  const filaFalsa = { id: 'fake-receta-id', producto: 'Producto Test' }
  const resultadoFalso = { rows: [filaFalsa], rowCount: 1 }
  return {
    query: vi.fn().mockResolvedValue(resultadoFalso),
    transaction: vi.fn(async (fn) => {
      const clienteFalso = { query: vi.fn().mockResolvedValue(resultadoFalso) }
      return fn(clienteFalso)
    }),
  }
})

vi.mock('../../services/bitacoraService.js', () => ({
  registrarActividad: vi.fn().mockResolvedValue(undefined),
}))

const recetasRoutes = (await import('../recetas.js')).default

function crearApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/recetas', recetasRoutes)
  // Handler de errores mínimo, igual de forma que index.js
  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' })
  })
  return app
}

function tokenValido() {
  return jwt.sign(
    { usuarioId: 'user-1', tenantId: 'tenant-1', email: 'test@marquez.com', nombre: 'Test', rol: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  )
}

const recetaBase = {
  producto: 'Pico de queso',
  piezas: 20,
}

describe('POST /api/recetas — validación costo cero intencional', () => {
  it('ingrediente con precio 0 y costo_cero_intencional=false responde 422 con el mensaje exacto', async () => {
    const app = crearApp()
    const res = await request(app)
      .post('/api/recetas')
      .set('Authorization', `Bearer ${tokenValido()}`)
      .send({
        ...recetaBase,
        ingredientes: [
          { nombre: 'Esencia de vainilla', cantidad: 30, unidad: 'ml', precio: 0, tipo: 'directo', costo_cero_intencional: false },
        ],
      })

    expect(res.status).toBe(422)
    expect(res.body.error).toBe(
      'El ingrediente "Esencia de vainilla" tiene un costo de C$ 0.00. Si esto es correcto, marca la casilla "Costo cero intencional" para este ingrediente.'
    )
  })

  it('ingrediente con precio 0 y costo_cero_intencional ausente (undefined) también responde 422', async () => {
    const app = crearApp()
    const res = await request(app)
      .post('/api/recetas')
      .set('Authorization', `Bearer ${tokenValido()}`)
      .send({
        ...recetaBase,
        ingredientes: [
          { nombre: 'Esencia de vainilla', cantidad: 30, unidad: 'ml', precio: 0 },
        ],
      })

    expect(res.status).toBe(422)
  })

  it('ingrediente con precio 0 y costo_cero_intencional=true NO responde 422', async () => {
    const app = crearApp()
    const res = await request(app)
      .post('/api/recetas')
      .set('Authorization', `Bearer ${tokenValido()}`)
      .send({
        ...recetaBase,
        ingredientes: [
          { nombre: 'Gas (indirecto)', cantidad: 1, unidad: 'porción', precio: 0, tipo: 'indirecto', costo_cero_intencional: true },
        ],
      })

    expect(res.status).not.toBe(422)
    expect(res.status).toBe(201)
  })

  it('ningún ingrediente en 0 no responde 422', async () => {
    const app = crearApp()
    const res = await request(app)
      .post('/api/recetas')
      .set('Authorization', `Bearer ${tokenValido()}`)
      .send({
        ...recetaBase,
        ingredientes: [
          { nombre: 'Harina', cantidad: 500, unidad: 'g', precio: 28, tipo: 'directo' },
        ],
      })

    expect(res.status).not.toBe(422)
    expect(res.status).toBe(201)
  })

  it('sin JWT válido responde 401 (requireAuth sigue protegiendo la ruta)', async () => {
    const app = crearApp()
    const res = await request(app)
      .post('/api/recetas')
      .send({
        ...recetaBase,
        ingredientes: [
          { nombre: 'Esencia de vainilla', cantidad: 30, unidad: 'ml', precio: 0, costo_cero_intencional: false },
        ],
      })

    expect(res.status).toBe(401)
  })
})

describe('PUT /api/recetas/:id — validación costo cero intencional', () => {
  it('ingrediente con precio 0 y costo_cero_intencional=false responde 422 con el mensaje exacto', async () => {
    const app = crearApp()
    const res = await request(app)
      .put('/api/recetas/fake-receta-id')
      .set('Authorization', `Bearer ${tokenValido()}`)
      .send({
        piezas: 20,
        ingredientes: [
          { nombre: 'Esencia de vainilla', cantidad: 30, unidad: 'ml', precio: 0, tipo: 'directo', costo_cero_intencional: false },
        ],
      })

    expect(res.status).toBe(422)
    expect(res.body.error).toBe(
      'El ingrediente "Esencia de vainilla" tiene un costo de C$ 0.00. Si esto es correcto, marca la casilla "Costo cero intencional" para este ingrediente.'
    )
  })

  it('ingrediente con precio 0 y costo_cero_intencional=true NO responde 422', async () => {
    const app = crearApp()
    const res = await request(app)
      .put('/api/recetas/fake-receta-id')
      .set('Authorization', `Bearer ${tokenValido()}`)
      .send({
        piezas: 20,
        ingredientes: [
          { nombre: 'Gas (indirecto)', cantidad: 1, unidad: 'porción', precio: 0, tipo: 'indirecto', costo_cero_intencional: true },
        ],
      })

    expect(res.status).not.toBe(422)
    expect(res.status).toBe(200)
  })

  it('ningún ingrediente en 0 no responde 422', async () => {
    const app = crearApp()
    const res = await request(app)
      .put('/api/recetas/fake-receta-id')
      .set('Authorization', `Bearer ${tokenValido()}`)
      .send({
        piezas: 20,
        ingredientes: [
          { nombre: 'Harina', cantidad: 500, unidad: 'g', precio: 28, tipo: 'directo' },
        ],
      })

    expect(res.status).not.toBe(422)
    expect(res.status).toBe(200)
  })

  it('sin JWT válido responde 401 (requireAuth sigue protegiendo la ruta)', async () => {
    const app = crearApp()
    const res = await request(app)
      .put('/api/recetas/fake-receta-id')
      .send({
        piezas: 20,
        ingredientes: [
          { nombre: 'Esencia de vainilla', cantidad: 30, unidad: 'ml', precio: 0, costo_cero_intencional: false },
        ],
      })

    expect(res.status).toBe(401)
  })
})
