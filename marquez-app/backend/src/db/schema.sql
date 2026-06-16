-- ============================================================
-- Marquéz Panadería & Repostería — Esquema de Base de Datos
-- v2.7 — Incluye config_fiscal y ventas
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Catálogo de productos ────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      VARCHAR(120) NOT NULL UNIQUE,
  precio      NUMERIC(10,2) NOT NULL,
  presentacion VARCHAR(50) DEFAULT 'unidad',
  categoria   VARCHAR(60),
  activo      BOOLEAN DEFAULT true,
  creado_en   TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ── Recetas ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recetas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto        VARCHAR(120) NOT NULL UNIQUE REFERENCES productos(nombre) ON UPDATE CASCADE,
  piezas          INTEGER NOT NULL DEFAULT 100,
  peso_por_pieza  NUMERIC(8,2) DEFAULT 0,
  merma_pct       NUMERIC(5,2) DEFAULT 0,
  notas           TEXT,
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Ingredientes de receta ────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingredientes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto        VARCHAR(120) NOT NULL,
  piezas_obj      INTEGER NOT NULL,
  piezas_reales   INTEGER,
  costo_directo   NUMERIC(12,2),
  costo_indirecto NUMERIC(12,2),
  costo_total     NUMERIC(12,2),
  costo_unitario  NUMERIC(12,4),
  precio_venta    NUMERIC(10,2),
  margen_pct      NUMERIC(6,2),
  margen_fiscal_pct NUMERIC(6,2),
  costo_fiscal_unitario NUMERIC(12,4),
  utilidad_neta   NUMERIC(12,2),
  aprobado        BOOLEAN,
  aprobado_fiscal BOOLEAN,
  factor_escala   NUMERIC(8,4),
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Inventario ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventario (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre          VARCHAR(100) NOT NULL UNIQUE,
  existencia      NUMERIC(12,3) NOT NULL DEFAULT 0,
  unidad          VARCHAR(20) DEFAULT 'kg',
  consumo_diario  NUMERIC(12,3) DEFAULT 0,
  punto_reposicion NUMERIC(12,3) DEFAULT 0,
  costo_unitario  NUMERIC(10,4) DEFAULT 0,
  actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Facturas de compras ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proveedor   VARCHAR(120),
  fecha       DATE DEFAULT CURRENT_DATE,
  total       NUMERIC(12,2),
  notas       TEXT,
  creado_en   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factura_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factura_id      UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  producto        VARCHAR(120),
  cantidad        NUMERIC(10,3),
  precio_actual   NUMERIC(10,4),
  precio_anterior NUMERIC(10,4),
  variacion_pct   NUMERIC(6,2),
  alerta          BOOLEAN DEFAULT false
);

-- ── Configuración fiscal DGI ──────────────────────────────────
-- Una sola fila activa (upsert por id=1).
-- Cuota fija: pago mensual fijo, ingresos < C$ 1,200,000/año.
-- Régimen general: declara IVA 15% e IR sobre utilidades.
CREATE TABLE IF NOT EXISTS config_fiscal (
  id                   INTEGER PRIMARY KEY DEFAULT 1,
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
  actualizado_en       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT config_fiscal_single_row CHECK (id = 1)
);

-- Fila única garantizada
INSERT INTO config_fiscal (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── Ventas ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ventas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  venta_id    UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto    VARCHAR(120) NOT NULL,
  cantidad    INTEGER NOT NULL DEFAULT 1,
  precio_unit NUMERIC(10,2) NOT NULL,
  subtotal    NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unit) STORED
);

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_costeos_producto    ON costeos(producto);
CREATE INDEX IF NOT EXISTS idx_costeos_creado_en   ON costeos(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_ingredientes_receta ON ingredientes(receta_id);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha       ON facturas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha         ON ventas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_creado_en     ON ventas(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_venta_items_venta    ON venta_items(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_items_producto ON venta_items(producto);

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
