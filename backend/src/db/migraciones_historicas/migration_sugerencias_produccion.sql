-- Unificación de producción: vínculo lotes -> ordenes_produccion + sugerencias de reposición
-- Ver HANDOFF_CONTEXT.md punto 8 para el contexto del diseño.

ALTER TABLE lotes
  ADD COLUMN orden_produccion_id uuid REFERENCES ordenes_produccion(id);

CREATE TABLE sugerencias_produccion (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  sucursal_id uuid NOT NULL REFERENCES sucursales(id),
  producto varchar NOT NULL,
  stock_actual numeric NOT NULL,
  stock_minimo numeric NOT NULL,
  atendida boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sugerencias_produccion_pendientes
  ON sugerencias_produccion (tenant_id, sucursal_id, producto, atendida);
