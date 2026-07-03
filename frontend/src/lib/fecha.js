// Nicaragua vive en UTC-6 fijo (America/Managua, sin horario de verano).
// new Date().toISOString() da la fecha en UTC, que se adelanta al día
// siguiente entre las 6pm y medianoche hora Nicaragua — por eso no se puede
// usar directo para "hoy". Este helper corrige ese desfase.
const OFFSET_MS = 6 * 60 * 60 * 1000

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function hoyNicaragua() {
  return new Date(Date.now() - OFFSET_MS).toISOString().slice(0, 10)
}

// fecha: "YYYY-MM-DD" o ISO completo: hora: "HH:MM:SS" o "HH:MM"
// Siempre devuelve la fecha completa (ej. "3 jul 07:34"), sin "Hoy"/"Ayer" —
// evita ambigüedad al revisar ventas de días distintos en la misma lista.
export function formatFechaHora(fecha, hora) {
  if (!fecha) return ''
  const fechaStr = String(fecha).slice(0, 10)
  const horaStr  = (hora || '').slice(0, 5)

  const [, m, d] = fechaStr.split('-').map(Number)
  return `${d} ${MESES[m - 1]} ${horaStr}`.trim()
}
