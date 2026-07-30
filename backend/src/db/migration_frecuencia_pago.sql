-- Migración: frecuencia de pago del negocio (config global, no por colaborador)
-- Correr manualmente en el SQL Editor de Supabase (con backup confirmado),
-- igual que las demás migraciones de este proyecto. No la corre un agente.
--
-- Contexto: Mario preguntó si al configurar "salario fijo mensual" de un
-- colaborador habíamos determinado si se paga en dos quincenas. La
-- frecuencia de pago (semanal/quincenal/mensual) ya existía como opción al
-- generar una Planilla, pero se elegía a mano cada vez, sin ningún default
-- guardado. Como todo el equipo cobra con la misma frecuencia (confirmado
-- con Mario), se guarda una sola vez a nivel de negocio en
-- configuracion_costeo, y el selector de Planilla se precarga con ese
-- valor (se puede seguir cambiando puntualmente si hace falta).

ALTER TABLE configuracion_costeo
  ADD COLUMN IF NOT EXISTS frecuencia_pago VARCHAR(10) NOT NULL DEFAULT 'quincenal';

ALTER TABLE configuracion_costeo
  DROP CONSTRAINT IF EXISTS configuracion_costeo_frecuencia_pago_check;

ALTER TABLE configuracion_costeo
  ADD CONSTRAINT configuracion_costeo_frecuencia_pago_check
  CHECK (frecuencia_pago IN ('semanal', 'quincenal', 'mensual'));
