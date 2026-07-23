-- Toggle diario de disponibilidad por producto, independiente del soft-delete (activo).
-- Permite marcar productos como agotados durante el día sin afectar el catálogo permanente.

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS disponible_hoy BOOLEAN NOT NULL DEFAULT true;
