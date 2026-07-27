// backend/src/utils/cifrado.js
// Cifrado simétrico (AES-256-GCM) para secretos guardados en la base de
// datos, como el access_token de WhatsApp en tenant_whatsapp_config.
//
// La clave se lee exclusivamente de WHATSAPP_TOKEN_ENCRYPTION_KEY (32 bytes
// en base64) — nunca se genera ni se hardcodea acá. Nunca se loguea el
// valor descifrado ni la clave, en ningún punto.
//
// Rotación de clave:
// No hay mecanismo de fallback a una clave anterior. Si se rota
// WHATSAPP_TOKEN_ENCRYPTION_KEY sin más, todas las filas ya cifradas con
// la clave vieja quedan indescifrables (descifrar() empieza a fallar para
// esas filas). Procedimiento correcto para rotar:
//   1. Mantener la clave vieja disponible temporalmente como
//      WHATSAPP_TOKEN_ENCRYPTION_KEY_OLD (variable de entorno separada).
//   2. Escribir un script puntual (no incluido todavía) que recorra las
//      filas cifradas, descifre cada una con la clave vieja y la vuelva a
//      cifrar con la clave nueva (WHATSAPP_TOKEN_ENCRYPTION_KEY).
//   3. Correr ese script contra producción con ambas variables presentes.
//   4. Verificar que todo descifra correctamente con la clave nueva.
//   5. Recién ahí, sacar WHATSAPP_TOKEN_ENCRYPTION_KEY_OLD del entorno.

import crypto from 'crypto'

const PREFIJO = 'v1:'
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16

function validarFormatoClave(claveBase64) {
  if (!claveBase64) {
    throw new Error('WHATSAPP_TOKEN_ENCRYPTION_KEY no está configurado en el entorno.')
  }
  const clave = Buffer.from(claveBase64, 'base64')
  if (clave.length !== 32) {
    throw new Error('WHATSAPP_TOKEN_ENCRYPTION_KEY debe decodificar a 32 bytes (AES-256).')
  }
  return clave
}

function obtenerClave() {
  return validarFormatoClave(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY)
}

// Valida que la clave esté presente y bien formada, sin descifrar nada.
// Pensada para chequear la configuración al arranque del servidor, antes
// de que llegue el primer mensaje de WhatsApp.
export function validarClaveConfigurada() {
  validarFormatoClave(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY)
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
