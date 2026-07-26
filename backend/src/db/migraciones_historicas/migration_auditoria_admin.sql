-- ============================================================
-- Master Baker — Auditoría de precios + protección Admin
-- v2.8.1
--
-- No requiere tabla de usuarios: el PIN vive en variable de
-- entorno del backend (ADMIN_PIN). Esta tabla solo registra
-- QUÉ cambió, CUÁNDO y de DÓNDE — no quién (porque no hay login
-- individual todavía, solo hay un único Admin).
-- ============================================================

CREATE TABLE IF NOT EXISTS auditoria_precios (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('producto', 'insumo')),
  entidad_id      UUID NOT NULL,           -- id del producto o insumo afectado
  entidad_nombre  VARCHAR(120) NOT NULL,   -- nombre guardado en el momento del cambio (por si se borra después)
  campo           VARCHAR(30) NOT NULL DEFAULT 'precio',
  valor_anterior  NUMERIC(12,4),
  valor_nuevo     NUMERIC(12,4) NOT NULL,
  valor_anterior_texto VARCHAR(255),
  valor_nuevo_texto    VARCHAR(255),
  metodo          VARCHAR(20) NOT NULL DEFAULT 'individual'
                    CHECK (metodo IN ('individual', 'masivo_lista', 'masivo_porcentaje')),
  porcentaje_aplicado NUMERIC(6,2),        -- solo si metodo = masivo_porcentaje
  ip_origen       VARCHAR(45),
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_precios_tenant   ON auditoria_precios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_precios_creado   ON auditoria_precios(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_precios_entidad  ON auditoria_precios(entidad_id);
