import { describe, it, expect, beforeAll } from 'vitest'
import { cifrar, descifrar } from '../cifrado.js'

beforeAll(() => {
  // Clave de prueba, solo para este test — no es una clave real.
  process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
})

describe('cifrado', () => {
  it('descifra lo que cifró, devolviendo el texto original', () => {
    const original = 'texto de prueba'
    const cifrado = cifrar(original)
    expect(cifrado.startsWith('v1:')).toBe(true)
    expect(descifrar(cifrado)).toBe(original)
  })

  it('deja pasar sin cambios un valor sin el prefijo v1: (token legado)', () => {
    const legado = 'EAAtoken-legado-sin-cifrar'
    expect(descifrar(legado)).toBe(legado)
  })
})
