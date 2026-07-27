// backend/src/utils/cifrado.js
// Cifrado simétrico (AES-256-GCM) para secretos guardados en la base de
// datos, como el access_token de WhatsApp en tenant_whatsapp_config.
//
// La clave se lee exclusivamente de WHATSAPP_TOKEN_ENCRYPTION_KEY (32 bytes
// en base64) — nunca se genera ni se hardcodea acá. Nunca se loguea el
// valor descifrado ni la clave, en ningún punto.

import crypto from 'crypto'

const PREFIJO = 'v1:'
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16

function obtenerClave() {
  const claveBase64 = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY
  if (!claveBase64) {
    throw new Error('WHATSAPP_TOKEN_ENCRYPTION_KEY no está configurado en el entorno.')
  }
  const clave = Buffer.from(claveBase64, 'base64')
  if (clave.length !== 32) {
    throw new Error('WHATSAPP_TOKEN_ENCRYPTION_KEY debe decodificar a 32 bytes (AES-256).')
  }
  return clave
}

export function cifrar(texto) {
  const clave = obtenerClave()
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv('aes-256-gcm', clave, iv)
  const ciphertext = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, authTag, ciphertext])
  return PREFIJO + payload.toString('base64')
}

export function descifrar(valor) {
  if (!valor.startsWith(PREFIJO)) {
    // Token legado, todavía no pasó por el backfill — se devuelve tal cual
    // a propósito, para no romper el bot antes de correr el backfill.
    return valor
  }
  const clave = obtenerClave()
  const payload = Buffer.from(valor.slice(PREFIJO.length), 'base64')
  const iv = payload.subarray(0, IV_BYTES)
  const authTag = payload.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES)
  const ciphertext = payload.subarray(IV_BYTES + AUTH_TAG_BYTES)
  const decipher = crypto.createDecipheriv('aes-256-gcm', clave, iv)
  decipher.setAuthTag(authTag)
  const texto = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return texto.toString('utf8')
}
