-- ============================================================
-- Master Baker — Esquema de Base de Datos
-- v2.8 — Multi-tenant desde el origen (toda tabla lleva tenant_id)
--
-- Si esta es una instalación NUEVA (Supabase vacío), corre este
-- archivo completo. Si ya tenías v2.7 corriendo en producción,
-- usa migration_multitenant.sql en su lugar — no corras este
-- archivo sobre datos existentes, los CREATE TABLE no tocarán
-- tablas ya creadas pero las constraints UNIQUE sí podrían chocar.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tenants (panaderías clientes de Master Baker) ─────────────
CREATE TABLE IF NOT EXISTS tenants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            VARCHAR(60) NOT NULL UNIQUE,
  nombre_negocio  VARCHAR(120) NOT NULL,
  pais            VARCHAR(60) DEFAULT 'Nicaragua',
  moneda          VARCHAR(10) DEFAULT 'C$',
  margen_objetivo NUMERIC(5,2) DEFAULT 57,
  activo          BOOLEAN DEFAULT true,
  plan            VARCHAR(30) DEFAULT 'trial',
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO tenants (id, slug, nombre_negocio, pais, moneda, margen_objetivo)
VALUES ('00000000-0000-0000-0000-000000000001', 'marquez', 'Marquéz Panadería & Repostería', 'Nicaragua', 'C$', 57)
ON CONFLICT (id) DO NOTHING;

-- ── Catálogo de productos ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  nombre        VARCHAR(120) NOT NULL,
  precio        NUMERIC(10,2) NOT NULL,
  presentacion  VARCHAR(50) DEFAULT 'unidad',
  categoria     VARCHAR(60),
  activo        BOOLEAN DEFAULT true,
  creado_en     TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, nombre)
);

-- ── Recetas ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recetas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  producto        VARCHAR(120) NOT NULL,
  piezas          INTEGER NOT NULL DEFAULT 100,
  peso_por_pieza  NUMERIC(8,2) DEFAULT 0,
  merma_pct       NUMERIC(5,2) DEFAULT 0,
  notas           TEXT,
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, producto),
  FOREIGN KEY (tenant_id, producto) REFERENCES productos(tenant_id, nombre) ON UPDATE CASCADE
);

-- ── Ingredientes de receta ────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingredientes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  receta_id  UUID NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  nombre     VARCHAR(100) NOT NULL,
  cantidad   NUMERIC(12,4) NOT NULL,
  unidad     VARCHAR(20) DEFAULT 'kg',
  precio     NUMERIC(10,4) DEFAULT 0,
  tipo       VARCHAR(20) DEFAULT 'directo' CHECK (tipo IN ('directo','indirecto')),
  orden      INTEGER DEFAULT 0
);

-- ── Costeos guardados ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS costeos (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  producto              VARCHAR(120) NOT NULL,
  piezas_obj            INTEGER NOT NULL,
  piezas_reales         INTEGER,
  costo_directo         NUMERIC(12,2),
  costo_indirecto       NUMERIC(12,2),
  costo_total           NUMERIC(12,2),
  costo_unitario        NUMERIC(12,4),
  precio_venta          NUMERIC(10,2),
  margen_pct            NUMERIC(6,2),
  margen_fiscal_pct     NUMERIC(6,2),
  costo_fiscal_unitario NUMERIC(12,4),
  utilidad_neta         NUMERIC(12,2),
  aprobado              BOOLEAN,
  aprobado_fiscal       BOOLEAN,
  factor_escala         NUMERIC(8,4),
  creado_en             TIMESTAMPTZ DEFAULT NOW()
);

-- ── Inventario ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventario (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  nombre            VARCHAR(100) NOT NULL,
  existencia        NUMERIC(12,3) NOT NULL DEFAULT 0,
  unidad            VARCHAR(20) DEFAULT 'kg',
  consumo_diario    NUMERIC(12,3) DEFAULT 0,
  punto_reposicion  NUMERIC(12,3) DEFAULT 0,
  costo_unitario    NUMERIC(10,4) DEFAULT 0,
  actualizado_en    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, nombre)
);

-- ── Facturas de compras ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  proveedor   VARCHAR(120),
  fecha       DATE DEFAULT CURRENT_DATE,
  total       NUMERIC(12,2),
  notas       TEXT,
  creado_en   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factura_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  factura_id      UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  producto        VARCHAR(120),
  cantidad        NUMERIC(10,3),
  precio_actual   NUMERIC(10,4),
  precio_anterior NUMERIC(10,4),
  variacion_pct   NUMERIC(6,2),
  alerta          BOOLEAN DEFAULT false
);

-- ── Configuración fiscal DGI ──────────────────────────────────
-- PK es tenant_id: cada panadería tiene exactamente una fila propia.
CREATE TABLE IF NOT EXISTS config_fiscal (
  tenant_id            UUID PRIMARY KEY REFERENCES tenants(id),
  regimen              VARCHAR(20) NOT NULL DEFAULT 'cuota_fija'
                         CHECK (regimen IN ('cuota_fija', 'reg_general')),
  cuota_fija           NUMERIC(10,2) DEFAULT 0,
  ir_anual             NUMERIC(10,2) DEFAULT 0,
  iva_aplica           VARCHAR(10) DEFAULT 'Ninguno'
                         CHECK (iva_aplica IN ('Ninguno', 'Algunos', 'Todos')),
  produccion_mensual   INTEGER DEFAULT 1,
  nombre_negocio       VARCHAR(120) DEFAULT 'Master Baker',
  ruc                  VARCHAR(20) DEFAULT '',
  configurado          BOOLEAN DEFAULT false,
  actualizado_en       TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO config_fiscal (tenant_id) VALUES ('00000000-0000-0000-0000-000000000001') ON CONFLICT (tenant_id) DO NOTHING;

-- ── Ventas ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ventas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  hora        TIME NOT NULL DEFAULT NOW()::TIME,
  cliente     VARCHAR(120) DEFAULT 'Sin nombre',
  canal       VARCHAR(30) DEFAULT 'tienda'
                CHECK (canal IN ('tienda', 'whatsapp', 'encargo')),
  metodo_pago VARCHAR(20) DEFAULT 'efectivo'
                CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia')),
  total       NUMERIC(12,2) NOT NULL,
  creado_en   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venta_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  venta_id    UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto    VARCHAR(120) NOT NULL,
  cantidad    INTEGER NOT NULL DEFAULT 1,
  precio_unit NUMERIC(10,2) NOT NULL,
  subtotal    NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unit) STORED
);

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_productos_tenant     ON productos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recetas_tenant       ON recetas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ingredientes_tenant  ON ingredientes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ingredientes_receta  ON ingredientes(receta_id);
CREATE INDEX IF NOT EXISTS idx_costeos_tenant        ON costeos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_costeos_producto      ON costeos(producto);
CREATE INDEX IF NOT EXISTS idx_costeos_creado_en     ON costeos(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_inventario_tenant     ON inventario(tenant_id);
CREATE INDEX IF NOT EXISTS idx_facturas_tenant       ON facturas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha        ON facturas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_factura_items_tenant  ON factura_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ventas_tenant_fecha   ON ventas(tenant_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_creado_en      ON ventas(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_venta_items_tenant    ON venta_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_venta_items_venta     ON venta_items(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_items_producto  ON venta_items(producto);

-- ── Función: actualizar timestamp automáticamente ─────────────
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.actualizado_en = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_recetas_ts
  BEFORE UPDATE ON recetas
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE OR REPLACE TRIGGER trg_inventario_ts
  BEFORE UPDATE ON inventario
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE OR REPLACE TRIGGER trg_config_fiscal_ts
  BEFORE UPDATE ON config_fiscal
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE OR REPLACE TRIGGER trg_tenants_ts
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
