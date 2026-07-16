/**
 * aiUsageService.js
 *
 * Registra el consumo de tokens de IA por tenant, para el panel de
 * fundadores (columna "Tokens IA"). Se llama después de cada respuesta
 * exitosa del proveedor de IA — nunca bloquea ni rompe la respuesta al
 * usuario si el registro falla (es solo telemetría, no algo crítico).
 */
import { query } from '../db/client.js'

export function registrarUsoTokens(tenantId, tokens) {
  if (!tenantId || !tokens) return
  const input = Number(tokens.input_tokens) || 0
  const output = Number(tokens.output_tokens) || 0
  if (!input && !output) return

  query(
    'INSERT INTO ai_usage_log (tenant_id, input_tokens, output_tokens) VALUES ($1, $2, $3)',
    [tenantId, input, output]
  ).catch(e => {
    console.warn('[aiUsageService] No se pudo registrar uso de tokens:', e.message)
  })
}
