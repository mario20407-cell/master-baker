-- ============================================================
-- Master Baker — Migración Multi-Tenant
-- v2.8 — Agrega capa de aislamiento por tenant (panadería)
--
-- ESTRATEGIA: columna tenant_id en cada tabla + UNIQUE compuesto.
-- No se elimina ningún dato existente — Marquéz se preserva
-- como el primer tenant con un UUID fijo y conocido.
-- ============================================================

-- ── Tabla de tenants (panaderías clientes de Master Baker) ───
CREATE TABLE IF NOT EXISTS tenants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            VARCHAR(60) NOT NULL UNIQUE,       -- ej: 'marquez', usado en subdominios/URLs
  nombre_negocio  VARCHAR(120) NOT NULL,
  pais            VARCHAR(60) DEFAULT 'Nicaragua',
  moneda          VARCHAR(10) DEFAULT 'C$',
  margen_objetivo NUMERIC(5,2) DEFAULT 57,           -- cada tenant puede tener su propio margen
  activo          BOOLEAN DEFAULT true,
  plan            VARCHAR(30) DEFAULT 'trial',        -- trial | basico | pro (para cuando haya facturación)
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tenant fijo de Marquéz — UUID conocido para no romper datos existentes ──
-- Este UUID es fijo a propósito: lo usamos en el middleware como default
-- mientras no exista sistema de login. NUNCA cambiar este valor en producción.
INSERT INTO tenants (id, slug, nombre_negocio, pais, moneda, margen_objetivo)
VALUES ('00000000-0000-0000-0000-000000000001', 'marquez', 'Marquéz Panadería & Repostería', 'Nicaragua', 'C$', 57)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Agregar tenant_id a cada tabla existente, con default al
-- tenant de Marquéz para no romper las filas que ya existen.
-- ============================================================

ALTER TABLE productos      ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id);
ALTER TABLE recetas        ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id);
ALTER TABLE ingredientes   ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id);
ALTER TABLE costeos        ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id);
ALTER TABLE inventario     ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id);
ALTER TABLE facturas       ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id);
ALTER TABLE factura_items  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id);
ALTER TABLE ventas         ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id);
ALTER TABLE venta_items    ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id);

-- ── config_fiscal: cambia de fila única global a fila única POR tenant ──
-- Quitamos la restricción de id=1 fija y la migramos a tenant_id como PK.
ALTER TABLE config_fiscal DROP CONSTRAINT IF EXISTS config_fiscal_single_row;
ALTER TABLE config_fiscal ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE config_fiscal SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE config_fiscal ALTER COLUMN tenant_id SET NOT NULL;
-- La fila de config fiscal antigua usaba id=1; ahora la unicidad es por tenant_id.
ALTER TABLE config_fiscal DROP CONSTRAINT IF EXISTS config_fiscal_pkey;
ALTER TABLE config_fiscal ADD PRIMARY KEY (tenant_id);
ALTER TABLE config_fiscal DROP COLUMN IF EXISTS id;

-- ============================================================
-- Corregir restricciones UNIQUE para que sean por tenant.
-- Sin esto, dos panaderías no podrían tener ambas "Dona azucarada".
-- ============================================================

ALTER TABLE productos  DROP CONSTRAINT IF EXISTS productos_nombre_key;
ALTER TABLE productos  ADD CONSTRAINT productos_tenant_nombre_key UNIQUE (tenant_id, nombre);

ALTER TABLE recetas    DROP CONSTRAINT IF EXISTS recetas_producto_key;
ALTER TABLE recetas    ADD CONSTRAINT recetas_tenant_producto_key UNIQUE (tenant_id, producto);

ALTER TABLE inventario DROP CONSTRAINT IF EXISTS inventario_nombre_key;
ALTER TABLE inventario ADD CONSTRAINT inventario_tenant_nombre_key UNIQUE (tenant_id, nombre);

-- La FK de recetas.producto -> productos.nombre era global; debe ser compuesta.
ALTER TABLE recetas DROP CONSTRAINT IF EXISTS recetas_producto_fkey;
ALTER TABLE recetas ADD CONSTRAINT recetas_tenant_producto_fkey
  FOREIGN KEY (tenant_id, producto) REFERENCES productos(tenant_id, nombre) ON UPDATE CASCADE;
-- Nota: esto requiere que productos tenga UNIQUE(tenant_id, nombre), ya creado arriba.

-- ============================================================
-- Índices por tenant_id — toda query filtrará por esto primero,
-- así que cada tabla necesita un índice que arranque con tenant_id.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_productos_tenant     ON productos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recetas_tenant        ON recetas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ingredientes_tenant   ON ingredientes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_costeos_tenant        ON costeos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventario_tenant     ON inventario(tenant_id);
CREATE INDEX IF NOT EXISTS idx_facturas_tenant       ON facturas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_factura_items_tenant  ON factura_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ventas_tenant_fecha    ON ventas(tenant_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_venta_items_tenant    ON venta_items(tenant_id);

-- ── Trigger de timestamp para tenants ──────────────────────────
CREATE OR REPLACE TRIGGER trg_tenants_ts
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
