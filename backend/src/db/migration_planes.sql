-- ============================================================
-- Master Baker — Migración Planes y Uso de IA
-- Ya aplicada en producción (25 jul 2026, vía Supabase SQL Editor).
-- Se versiona acá después del hecho porque no había quedado en el repo.
-- ============================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_vence_en TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS planes (
  id                        VARCHAR(20) PRIMARY KEY,
  nombre_visible            VARCHAR(50) NOT NULL,
  precio_mensual_usd        NUMERIC(10,2),
  whatsapp_bot              BOOLEAN DEFAULT false,
  asesor_negocio            BOOLEAN DEFAULT false,
  costeo_masivo             BOOLEAN DEFAULT false,
  analisis_profundo         BOOLEAN DEFAULT false,
  leer_documentos           BOOLEAN DEFAULT false,
  limite_mensajes_ia_mes    INTEGER NOT NULL DEFAULT 0,
  creado_en                 TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en            TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO planes (id, nombre_visible, precio_mensual_usd, whatsapp_bot, asesor_negocio, costeo_masivo, analisis_profundo, leer_documentos, limite_mensajes_ia_mes)
VALUES
  ('trial', 'Prueba', NULL, true, true, true, true, true, 100),
  ('seed',  'Seed',   10.00, false, true, false, false, false, 200),
  ('pro',   'Pro',    30.00, true, true, true, true, true, 1000)
ON CONFLICT (id) DO UPDATE SET
  nombre_visible = EXCLUDED.nombre_visible,
  precio_mensual_usd = EXCLUDED.precio_mensual_usd,
  whatsapp_bot = EXCLUDED.whatsapp_bot,
  asesor_negocio = EXCLUDED.asesor_negocio,
  costeo_masivo = EXCLUDED.costeo_masivo,
  analisis_profundo = EXCLUDED.analisis_profundo,
  leer_documentos = EXCLUDED.leer_documentos,
  limite_mensajes_ia_mes = EXCLUDED.limite_mensajes_ia_mes,
  actualizado_en = NOW();

CREATE OR REPLACE TRIGGER trg_planes_ts
  BEFORE UPDATE ON planes
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TABLE IF NOT EXISTS uso_ia_mensual (
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  anio_mes         VARCHAR(7) NOT NULL,
  mensajes_usados  INTEGER NOT NULL DEFAULT 0,
  actualizado_en   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, anio_mes)
);

CREATE INDEX IF NOT EXISTS idx_uso_ia_mensual_tenant ON uso_ia_mensual(tenant_id);

UPDATE tenants SET plan = 'pro' WHERE id = '00000000-0000-0000-0000-000000000001' AND plan = 'trial';
