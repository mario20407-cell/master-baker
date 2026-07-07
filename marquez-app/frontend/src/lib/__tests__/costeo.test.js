// src/lib/__tests__/costeo.test.js
//
// Unit tests del motor de costeo — capa más crítica del negocio.
// Si estas pruebas fallan, hay dinero mal calculado en producción.

import { describe, it, expect } from 'vitest'
import {
  MARGEN_OBJETIVO,
  FACTOR_COSTO_MAX,
  calcMargen,
  calcPrecioMinimo,
  margenAprobado,
  validarMargen,
  calcFactorEscala,
  calcPiezasReales,
  escalarCantidad,
  sumarCostosIngredientes,
  calcularCosteoReceta,
} from '../costeo'

// ═══════════════════════════════════════════════════════════════════════════
// Constantes del negocio
// ═══════════════════════════════════════════════════════════════════════════
describe('Constantes del negocio', () => {
  it('MARGEN_OBJETIVO es 57% (regla actual de Marquéz)', () => {
    expect(MARGEN_OBJETIVO).toBe(57)
  })

  it('FACTOR_COSTO_MAX = 1 - MARGEN_OBJETIVO/100 = 0.43', () => {
    expect(FACTOR_COSTO_MAX).toBeCloseTo(0.43, 4)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// calcMargen
// ═══════════════════════════════════════════════════════════════════════════
describe('calcMargen', () => {
  it('calcula el margen correctamente con valores típicos', () => {
    // pventa=20, costo=8.55 → margen = (20-8.55)/20*100 = 57.25%
    expect(calcMargen(20, 8.55)).toBeCloseTo(57.25, 2)
  })

  it('devuelve 100% si el costo unitario es 0 (producto "gratis")', () => {
    expect(calcMargen(20, 0)).toBe(100)
  })

  it('devuelve un margen negativo si el costo supera el precio de venta', () => {
    expect(calcMargen(10, 15)).toBeCloseTo(-50, 2)
  })

  it('devuelve 0 si el precio de venta es 0 (evita división por cero)', () => {
    expect(calcMargen(0, 5)).toBe(0)
  })

  it('devuelve 0 si el precio de venta es negativo', () => {
    expect(calcMargen(-10, 5)).toBe(0)
  })

  it('maneja strings numéricos igual que números', () => {
    expect(calcMargen('20', '8.55')).toBeCloseTo(57.25, 2)
  })

  it('trata valores no numéricos como 0', () => {
    expect(calcMargen('abc', 'xyz')).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// calcPrecioMinimo — el cálculo más sensible del sistema
// ═══════════════════════════════════════════════════════════════════════════
describe('calcPrecioMinimo', () => {
  it('precio mínimo = costo / 0.43 para margen del 57%', () => {
    // costo=8.55 → pmin = 8.55 / 0.43 ≈ 19.88
    expect(calcPrecioMinimo(8.55)).toBeCloseTo(19.8837, 3)
  })

  it('a ese precio mínimo, el margen resultante es EXACTAMENTE 57%', () => {
    const costo = 8.55
    const pmin = calcPrecioMinimo(costo)
    const margenResultante = calcMargen(pmin, costo)
    expect(margenResultante).toBeCloseTo(MARGEN_OBJETIVO, 6)
  })

  it('devuelve 0 si el costo unitario es 0', () => {
    expect(calcPrecioMinimo(0)).toBe(0)
  })

  it('devuelve 0 si el costo unitario es negativo', () => {
    expect(calcPrecioMinimo(-5)).toBe(0)
  })

  it('es consistente: para cualquier costo > 0, el margen al precio mínimo es 57%', () => {
    for (const costo of [1, 2.5, 8.55, 100, 1250]) {
      const pmin = calcPrecioMinimo(costo)
      expect(calcMargen(pmin, costo)).toBeCloseTo(MARGEN_OBJETIVO, 5)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// margenAprobado
// ═══════════════════════════════════════════════════════════════════════════
describe('margenAprobado', () => {
  it('aprueba un margen igual al objetivo (57%)', () => {
    expect(margenAprobado(57)).toBe(true)
  })

  it('aprueba un margen mayor al objetivo', () => {
    expect(margenAprobado(60)).toBe(true)
  })

  it('rechaza un margen menor al objetivo', () => {
    expect(margenAprobado(56.99)).toBe(false)
  })

  it('rechaza margen negativo', () => {
    expect(margenAprobado(-10)).toBe(false)
  })

  it('rechaza null (sin datos suficientes)', () => {
    expect(margenAprobado(null)).toBe(false)
  })

  it('rechaza undefined (sin datos suficientes)', () => {
    expect(margenAprobado(undefined)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// validarMargen — regla "nunca calcular márgenes sin todos los costos"
// ═══════════════════════════════════════════════════════════════════════════
describe('validarMargen', () => {
  it('devuelve null si falta el precio de venta', () => {
    expect(validarMargen(0, 8.55)).toBeNull()
    expect(validarMargen(null, 8.55)).toBeNull()
  })

  it('devuelve null si falta el costo unitario', () => {
    expect(validarMargen(20, 0)).toBeNull()
    expect(validarMargen(20, null)).toBeNull()
  })

  it('devuelve { margen, aprobado: true } cuando el margen cumple 57%', () => {
    // pventa=22, costo=8.55 → margen ≈ 61.1%
    const res = validarMargen(22, 8.55)
    expect(res).not.toBeNull()
    expect(res.margen).toBeCloseTo(61.136, 2)
    expect(res.aprobado).toBe(true)
  })

  it('devuelve { margen, aprobado: false } cuando el margen es menor a 57%', () => {
    // pventa=20, costo=8.55 → margen = 57.25% ... probemos un caso < 57
    // pventa=20, costo=10 → margen = 50%
    const res = validarMargen(20, 10)
    expect(res.margen).toBeCloseTo(50, 2)
    expect(res.aprobado).toBe(false)
  })

  it('caso real Marquéz: Pico de queso a C$20 con costo C$8.55 → margen 57.25%, aprobado', () => {
    const res = validarMargen(20, 8.55)
    expect(res.margen).toBeCloseTo(57.25, 2)
    expect(res.aprobado).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// calcFactorEscala
// ═══════════════════════════════════════════════════════════════════════════
describe('calcFactorEscala', () => {
  it('calcula el factor correctamente (100 → 500 = ×5)', () => {
    expect(calcFactorEscala(100, 500)).toBe(5)
  })

  it('factor 1 cuando base y objetivo son iguales', () => {
    expect(calcFactorEscala(100, 100)).toBe(1)
  })

  it('factor menor a 1 cuando se reduce la producción', () => {
    expect(calcFactorEscala(100, 50)).toBe(0.5)
  })

  it('devuelve 1 si la base es 0 (evita división por cero)', () => {
    expect(calcFactorEscala(0, 500)).toBe(1)
  })

  it('devuelve 1 si la base es negativa', () => {
    expect(calcFactorEscala(-10, 500)).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// calcPiezasReales — merma
// ═══════════════════════════════════════════════════════════════════════════
describe('calcPiezasReales', () => {
  it('sin merma, las piezas reales son iguales al objetivo', () => {
    expect(calcPiezasReales(500, 0)).toBe(500)
  })

  it('aplica correctamente una merma del 15% (caso real masa dulce)', () => {
    // 500 * (1 - 0.15) = 425
    expect(calcPiezasReales(500, 15)).toBe(425)
  })

  it('redondea al entero más cercano (las piezas son discretas)', () => {
    // 18 piezas con 5% merma = 17.1 → redondea a 17
    expect(calcPiezasReales(18, 5)).toBe(17)
  })

  it('merma del 100% da 0 piezas', () => {
    expect(calcPiezasReales(100, 100)).toBe(0)
  })

  it('merma negativa se trata como sin merma', () => {
    expect(calcPiezasReales(100, -5)).toBe(100)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// escalarCantidad
// ═══════════════════════════════════════════════════════════════════════════
describe('escalarCantidad', () => {
  it('escala una cantidad por el factor dado', () => {
    expect(escalarCantidad(1.5, 5)).toBe(7.5)
  })

  it('factor por defecto es 1 (no escala)', () => {
    expect(escalarCantidad(1.5)).toBe(1.5)
  })

  it('escala correctamente con factores fraccionarios', () => {
    expect(escalarCantidad(1000, 0.5)).toBe(500)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// sumarCostosIngredientes
// ═══════════════════════════════════════════════════════════════════════════
describe('sumarCostosIngredientes', () => {
  it('separa correctamente costos directos e indirectos', () => {
    const ingredientes = [
      { nombre: 'Harina', cantidad: 1, precio: 30, tipo: 'directo' },
      { nombre: 'Azúcar', cantidad: 0.12, precio: 40, tipo: 'directo' },
      { nombre: 'Gas (indirecto)', cantidad: 1, precio: 15, tipo: 'indirecto' },
      { nombre: 'Mano de obra (indirecto)', cantidad: 1, precio: 40, tipo: 'indirecto' },
    ]
    const res = sumarCostosIngredientes(ingredientes)
    expect(res.costoDirecto).toBeCloseTo(30 + 4.8, 4)   // 34.8
    expect(res.costoIndirecto).toBeCloseTo(55, 4)        // 15 + 40
    expect(res.costoTotal).toBeCloseTo(89.8, 4)
  })

  it('aplica el factor de escala a todas las cantidades', () => {
    const ingredientes = [{ nombre: 'Harina', cantidad: 1, precio: 30, tipo: 'directo' }]
    const res = sumarCostosIngredientes(ingredientes, 5) // factor ×5
    expect(res.costoDirecto).toBe(150)
    expect(res.costoTotal).toBe(150)
  })

  it('lista vacía devuelve todo en 0', () => {
    const res = sumarCostosIngredientes([])
    expect(res).toEqual({ costoDirecto: 0, costoIndirecto: 0, costoTotal: 0 })
  })

  it('sin argumentos devuelve todo en 0 (no rompe)', () => {
    const res = sumarCostosIngredientes()
    expect(res).toEqual({ costoDirecto: 0, costoIndirecto: 0, costoTotal: 0 })
  })

  it('ingrediente sin tipo se trata como directo', () => {
    const res = sumarCostosIngredientes([{ cantidad: 1, precio: 10 }])
    expect(res.costoDirecto).toBe(10)
    expect(res.costoIndirecto).toBe(0)
  })

  it('ingrediente con precio o cantidad faltante no rompe (se trata como 0)', () => {
    const res = sumarCostosIngredientes([
      { nombre: 'Sin precio', cantidad: 5 },
      { nombre: 'Sin cantidad', precio: 10 },
    ])
    expect(res.costoTotal).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// calcularCosteoReceta — integración de todo el motor
// ═══════════════════════════════════════════════════════════════════════════
describe('calcularCosteoReceta', () => {
  // Receta basada en el caso real "Masa Dulce" discutido con el negocio:
  // 1000g harina, etc. → lote de 18 piezas de 85g, merma 15%
  const recetaMasaDulce = {
    piezas: 18,
    merma: 15,
    pventa: 20,
    ingredientes: [
      { nombre: 'Costo de masa', cantidad: 1, precio: 2.55, tipo: 'directo' },
      { nombre: 'GLP', cantidad: 1, precio: 1.50, tipo: 'indirecto' },
      { nombre: 'Mano de obra', cantidad: 1, precio: 3.00, tipo: 'indirecto' },
      { nombre: 'Empaque', cantidad: 1, precio: 1.50, tipo: 'directo' },
    ],
  }

  it('sin escalar (piezasObjetivo = null), usa las piezas base de la receta', () => {
    const res = calcularCosteoReceta(recetaMasaDulce)
    expect(res.factor).toBe(1)
    // 18 piezas con 15% merma → 15 piezas reales
    expect(res.piezasReales).toBe(15)
  })

  it('calcula el costo total correctamente (suma de los 4 ingredientes = 8.55)', () => {
    const res = calcularCosteoReceta(recetaMasaDulce)
    expect(res.costoTotal).toBeCloseTo(8.55, 4)
    expect(res.costoDirecto).toBeCloseTo(4.05, 4)   // 2.55 + 1.50
    expect(res.costoIndirecto).toBeCloseTo(4.50, 4) // 1.50 + 3.00
  })

  it('costo unitario = costoTotal / piezasReales = 8.55 / 15 = 0.57', () => {
    const res = calcularCosteoReceta(recetaMasaDulce)
    expect(res.costoUnitario).toBeCloseTo(0.57, 4)
  })

  it('a C$20 de venta con ese costo unitario, el margen es altísimo y está aprobado', () => {
    const res = calcularCosteoReceta(recetaMasaDulce)
    expect(res.margen).toBeGreaterThan(57)
    expect(res.aprobado).toBe(true)
  })

  it('escalar a más piezas multiplica costos proporcionalmente al factor', () => {
    // Escalar de 18 piezas base a 180 piezas objetivo → factor ×10
    const res = calcularCosteoReceta(recetaMasaDulce, 180)
    expect(res.factor).toBe(10)
    expect(res.costoTotal).toBeCloseTo(8.55 * 10, 3)
    // 180 piezas con 15% merma = 153
    expect(res.piezasReales).toBe(153)
  })

  it('escalar mantiene costo unitario y margen *aproximadamente* iguales (pequeñas variaciones por redondeo de piezas)', () => {
    // El redondeo de piezasReales (Math.round) hace que la proporcionalidad
    // no sea perfecta a baja escala: 18pz×85% = 15.3 → 15, pero
    // 180pz×85% = 153.0 → 153 exacto. Esa diferencia de redondeo (15 vs 15.3)
    // es real y esperada — las piezas son unidades discretas, no se vende
    // "0.3 piezas". A mayor escala, el error de redondeo se vuelve despreciable.
    const base = calcularCosteoReceta(recetaMasaDulce)
    const escalado = calcularCosteoReceta(recetaMasaDulce, 180)

    // Ambos deben seguir aprobados y con margen por encima del objetivo
    expect(base.aprobado).toBe(true)
    expect(escalado.aprobado).toBe(true)

    // La diferencia entre ambos costos unitarios debe ser pequeña (<5%),
    // atribuible solo al redondeo de piezas, no a un error de cálculo.
    const diffRelativa = Math.abs(escalado.costoUnitario - base.costoUnitario) / base.costoUnitario
    expect(diffRelativa).toBeLessThan(0.05)
  })

  it('a mayor escala (sin redondeo significativo), costo unitario y margen sí son proporcionales', () => {
    // Usamos una receta donde piezasBase * (1-merma) es un entero exacto,
    // así el redondeo no introduce diferencias y podemos validar
    // proporcionalidad estricta.
    const recetaExacta = {
      piezas: 20,       // 20 * 0.85 = 17 exacto
      merma: 15,
      pventa: 20,
      ingredientes: [{ nombre: 'X', cantidad: 1, precio: 8.55, tipo: 'directo' }],
    }
    const base = calcularCosteoReceta(recetaExacta)          // 20pz → 17 reales
    const escalado = calcularCosteoReceta(recetaExacta, 200) // 200pz → 170 reales

    expect(escalado.costoUnitario).toBeCloseTo(base.costoUnitario, 6)
    expect(escalado.margen).toBeCloseTo(base.margen, 6)
  })

  it('receta sin precio de venta: margen 0, no aprobado, pero sí calcula costos', () => {
    const sinPrecio = { ...recetaMasaDulce, pventa: 0 }
    const res = calcularCosteoReceta(sinPrecio)
    expect(res.costoTotal).toBeCloseTo(8.55, 4)
    expect(res.margen).toBe(0)
    expect(res.aprobado).toBe(false)
  })

  it('receta sin ingredientes: todos los costos en 0', () => {
    const vacia = { piezas: 10, merma: 0, pventa: 20, ingredientes: [] }
    const res = calcularCosteoReceta(vacia)
    expect(res.costoTotal).toBe(0)
    expect(res.costoUnitario).toBe(0)
    expect(res.margen).toBe(100) // costo 0 → margen 100%
    expect(res.aprobado).toBe(true)
  })

  it('caso de ALERTA: costo unitario alto produce margen bajo y precio mínimo mayor al actual', () => {
    const recetaCara = {
      piezas: 10,
      merma: 0,
      pventa: 20,
      ingredientes: [{ nombre: 'Ingrediente caro', cantidad: 1, precio: 100, tipo: 'directo' }],
    }
    const res = calcularCosteoReceta(recetaCara)
    // costoUnitario = 100/10 = 10 → margen = (20-10)/20*100 = 50% < 57%
    expect(res.costoUnitario).toBe(10)
    expect(res.margen).toBeCloseTo(50, 2)
    expect(res.aprobado).toBe(false)
    // precio mínimo para 57% con costo 10 → 10/0.43 ≈ 23.26, mayor al precio actual de 20
    expect(res.precioMinimo).toBeGreaterThan(res.pventa)
  })

  it('receta no definida no rompe — devuelve valores neutros en 0', () => {
    const res = calcularCosteoReceta(undefined)
    expect(res.costoTotal).toBe(0)
    expect(res.piezasReales).toBe(0)
    expect(res.margen).toBe(0)
    expect(res.aprobado).toBe(false)
  })
})
