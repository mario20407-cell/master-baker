// Normaliza texto: quita tildes y pasa a minusculas para comparacion flexible
export const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
