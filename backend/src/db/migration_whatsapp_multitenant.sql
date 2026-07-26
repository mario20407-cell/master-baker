-- ============================================================
-- Master Baker — Migración WhatsApp Multi-Tenant
-- Agrega la tabla de configuración de WhatsApp por tenant, para
-- que el webhook pueda resolver a qué panadería pertenece cada
-- mensaje según el phone_number_id que manda Meta.
--
-- No incluye secretos — los tokens reales se cargan aparte con
-- backend/src/db/migrar_whatsapp_marquez.js (lee de variables de entorno).
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_whatsapp_config (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL UNIQUE REFERENCES tenants(id),
  phone_number_id  VARCHAR(60) NOT NULL UNIQUE,
  access_token     TEXT NOT NULL,
  activo           BOOLEAN DEFAULT true,
  creado_en        TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ DEFAULT NOW()
);
