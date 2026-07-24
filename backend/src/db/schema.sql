-- ============================================================
-- Master Baker — Esquema de Base de Datos
-- v3.0 — Consolidado contra el esquema real de producción (Supabase),
-- verificado vía information_schema el 2026-07-23. Sustituye a v2.8,
-- que había quedado muy por detrás de lo que realmente corre en vivo
-- (le faltaban costeo de mano de obra, perfil laboral, CRM de WhatsApp,
-- sucursales/producción, bitácora, auditoría de precios y más).
--
-- Si esta es una instalación NUEVA (Supabase vacío), corre este
-- archivo completo — es la fuente de verdad. Los archivos de
-- backend/src/db/migraciones_historicas/ ya están aplicados en
-- producción y solo se conservan como registro histórico; no hace
-- falta correrlos de nuevo.
--
-- NOTA: la base de producción también contiene tablas huérfanas de
-- migraciones pasadas sin ninguna referencia en el código actual
-- (backups *_old_backup*, "Recetas Base", whatsapp_mensajes,
-- inventario_materia_prima, receta_detalles, productos_derivados, y
-- el trío pagos/pagos_auditoria/suscripciones de un sistema de
-- suscripciones que nunca se conectó). Deliberadamente NO se
-- reproducen aquí — este archivo define el esquema vigente, no un
-- espejo byte a byte de la cuenta de Supabase actual.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tenants (panaderías clientes de Master Baker) ─────────────
CREATE TABLE IF NOT EXISTS tenants (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug                      VARCHAR(60) NOT NULL UNIQUE,
  nombre_negocio            VARCHAR(120) NOT NULL,
  pais                      VARCHAR(60) DEFAULT 'Nicaragua',
  moneda                    VARCHAR(10) DEFAULT 'C$',
  margen_objetivo           NUMERIC(5,2) DEFAULT 57,
  activo                    BOOLEAN DEFAULT true,
  plan                      VARCHAR(30) DEFAULT 'trial',
  plan_activado_en          TIMESTAMPTZ DEFAULT NOW(),
  plan_notas                TEXT,
  trial_vence_en            TIMESTAMPTZ,
  whatsapp_taller           VARCHAR(20),
  whatsapp_compras          VARCHAR(20),
  whatsapp_jefe_operaciones VARCHAR(20),
  whatsapp_token            TEXT,
  whatsapp_phone_id         VARCHAR(50),
  admin_pin_hash            TEXT,
  creado_en                 TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en            TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO tenants (id, slug, nombre_negocio, pais, moneda, margen_objetivo)
VALUES ('00000000-0000-0000-0000-000000000001', 'marquez', 'Marquéz Panadería & Repostería', 'Nicaragua', 'C$', 57)
ON CONFLICT (id) DO NOTHING;

-- ── Planes (define qué funciones habilita cada plan de suscripción) ──
CREATE TABLE IF NOT EXISTS planes (
  id                      VARCHAR(20) PRIMARY KEY,
  nombre_visible          VARCHAR(50) NOT NULL,
  whatsapp_bot            BOOLEAN NOT NULL DEFAULT false,
  asesor_negocio          BOOLEAN NOT NULL DEFAULT false,
  costeo_masivo           BOOLEAN NOT NULL DEFAULT false,
  analisis_profundo       BOOLEAN NOT NULL DEFAULT false,
  leer_documentos         BOOLEAN NOT NULL DEFAULT false,
  limite_mensajes_ia_mes  INTEGER,
  precio_mensual_usd      NUMERIC(10,2),
  actualizado_en          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Usuarios del sistema (incluye perfil laboral para costeo de mano de obra) ──
CREATE TABLE IF NOT EXISTS usuarios (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  email           VARCHAR(120) NOT NULL,
  password_hash   VARCHAR(255),
  nombre          VARCHAR(120) NOT NULL,
  rol             VARCHAR(20) NOT NULL DEFAULT 'operario' CHECK (rol IN ('admin','operario')),
  permisos        VARCHAR(50)[] DEFAULT ARRAY['ver_recetas','registrar_ventas','ver_inventario','ver_produccion','ver_catalogo']::VARCHAR(50)[],
  activo          BOOLEAN DEFAULT true,
  ultimo_login    TIMESTAMPTZ,
  -- Perfil laboral, usado por pasivosLaboralesService.js para calcular
  -- INSS patronal/INATEC/aguinaldo/vacaciones y sugerir el costo de
  -- mano de obra en configuracion_costeo.
  tipo_pago       VARCHAR(10) NOT NULL DEFAULT 'fijo',
  salario_mensual NUMERIC,
  fecha_ingreso   DATE,
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (email)
);

-- ── Pagos variables (destajo/por producción) de colaboradores tipo_pago='variable' ──
CREATE TABLE IF NOT EXISTS pagos_variables (
  id         SERIAL PRIMARY KEY,
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  mes        DATE NOT NULL,
  monto      NUMERIC NOT NULL,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, mes)
);

-- ── Sucursales ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sucursales (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  nombre     VARCHAR(120) NOT NULL,
  direccion  TEXT,
  activo     BOOLEAN DEFAULT true,
  creado_en  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, nombre)
);

-- ── Catálogo de productos ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  nombre          VARCHAR(120) NOT NULL,
  precio          NUMERIC(10,2) NOT NULL,
  presentacion    VARCHAR(50) DEFAULT 'unidad',
  categoria       VARCHAR(60),
  activo          BOOLEAN DEFAULT true,
  disponible_hoy  BOOLEAN NOT NULL DEFAULT true,
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ DEFAULT NOW(),
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
  costo_directo   NUMERIC(12,4) DEFAULT 0,
  costo_indirecto NUMERIC(12,4) DEFAULT 0,
  margen_aplicado NUMERIC(5,2) DEFAULT 0,
  precio_sugerido NUMERIC(12,4) DEFAULT 0,
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, producto),
  FOREIGN KEY (tenant_id, producto) REFERENCES productos(tenant_id, nombre) ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS ingredientes (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id              UUID NOT NULL REFERENCES tenants(id),
  receta_id              UUID NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  nombre                 VARCHAR(100) NOT NULL,
  cantidad               NUMERIC(12,4) NOT NULL,
  unidad                 VARCHAR(20) DEFAULT 'g',
  precio                 NUMERIC(12,6) DEFAULT 0,
  tipo                   VARCHAR(20) DEFAULT 'directo' CHECK (tipo IN ('directo','indirecto')),
  orden                  INTEGER DEFAULT 0,
  subreceta_nombre       VARCHAR(100),
  unidad_inventario      VARCHAR(20),
  unidad_precio          VARCHAR(20),
  costo_cero_intencional BOOLEAN NOT NULL DEFAULT false
);

-- ── Costeos guardados ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS costeos (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001',
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

-- ── Inventario de materia prima ──────────────────────────────────
CREATE TABLE IF NOT EXISTS inventario (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  nombre            VARCHAR(100) NOT NULL,
  existencia        NUMERIC(12,3) NOT NULL DEFAULT 0,
  unidad            VARCHAR(20) DEFAULT 'g',
  consumo_diario    NUMERIC(12,3) DEFAULT 0,
  punto_reposicion  NUMERIC(12,3) DEFAULT 0,
  costo_unitario    NUMERIC(12,6) DEFAULT 0,
  densidad_g_ml     NUMERIC(10,4),
  activo            BOOLEAN DEFAULT true,
  actualizado_en    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, nombre)
);

-- ── Inventario de producto terminado, por sucursal ───────────────
CREATE TABLE IF NOT EXISTS inventario_terminado (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id),
  sucursal_id        UUID NOT NULL REFERENCES sucursales(id),
  producto           TEXT NOT NULL,
  stock              INTEGER NOT NULL DEFAULT 0,
  stock_minimo       INTEGER NOT NULL DEFAULT 0,
  unidad             VARCHAR(30) NOT NULL DEFAULT 'unidad',
  actualizado_en     TIMESTAMPTZ DEFAULT NOW(),
  alerta_enviada_en  TIMESTAMPTZ,
  UNIQUE (tenant_id, sucursal_id, producto)
);

-- ── Facturas de compras ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  proveedor   VARCHAR(120),
  fecha       DATE DEFAULT CURRENT_DATE,
  total       NUMERIC(12,2),
  notas       TEXT,
  creado_en   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factura_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001',
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

-- ── Configuración de costeo: gastos indirectos y margen objetivo ──
-- PK es tenant_id, igual que config_fiscal. costo_indirecto_mano se
-- alimenta con la sugerencia de /configuracion-costeo/sugerencia-mano-obra
-- (INSS patronal + INATEC + provisión de aguinaldo/vacaciones), pero
-- el valor aplicado en el costeo de recetas es siempre el guardado acá.
CREATE TABLE IF NOT EXISTS configuracion_costeo (
  tenant_id             UUID PRIMARY KEY REFERENCES tenants(id),
  costo_indirecto_gas   NUMERIC(10,4) NOT NULL DEFAULT 0,
  costo_indirecto_luz   NUMERIC(10,4) NOT NULL DEFAULT 0,
  costo_indirecto_mano  NUMERIC(10,4) NOT NULL DEFAULT 0,
  margen_objetivo       NUMERIC(5,2) NOT NULL DEFAULT 57.00,
  actualizado_en        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Ventas ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ventas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  hora        TIME NOT NULL DEFAULT NOW()::TIME,
  cliente     VARCHAR(120) DEFAULT 'Sin nombre',
  canal       VARCHAR(30) DEFAULT 'tienda'
                CHECK (canal IN ('tienda', 'whatsapp', 'encargo')),
  metodo_pago VARCHAR(20) DEFAULT 'efectivo'
                CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia')),
  total       NUMERIC(12,2) NOT NULL,
  sucursal_id UUID REFERENCES sucursales(id),
  creado_en   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venta_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  venta_id    UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto    VARCHAR(120) NOT NULL,
  cantidad    INTEGER NOT NULL DEFAULT 1,
  precio_unit NUMERIC(10,2) NOT NULL,
  subtotal    NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unit) STORED
);

-- ── Producción: órdenes, lotes, distribución a sucursales y caja ──
CREATE TABLE IF NOT EXISTS ordenes_produccion (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  producto    VARCHAR(120) NOT NULL,
  piezas      INTEGER NOT NULL,
  estado      VARCHAR(20) DEFAULT 'completada',
  notas       TEXT,
  creado_por  UUID,
  creado_en   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lotes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  producto              TEXT NOT NULL,
  cantidad              INTEGER NOT NULL,
  unidad                VARCHAR(30) NOT NULL DEFAULT 'unidad',
  costo_total           NUMERIC(10,2) DEFAULT 0,
  fecha                 DATE NOT NULL DEFAULT CURRENT_DATE,
  estado                VARCHAR(20) NOT NULL DEFAULT 'producido',
  notas                 TEXT,
  orden_produccion_id   UUID REFERENCES ordenes_produccion(id),
  creado_en             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lote_distribuciones (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  lote_id     UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES sucursales(id),
  cantidad    INTEGER NOT NULL CHECK (cantidad > 0),
  creado_en   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lote_id, sucursal_id)
);

CREATE TABLE IF NOT EXISTS caja_produccion (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  lote_id           UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  cantidad_inicial  INTEGER NOT NULL,
  cantidad_vendida  INTEGER NOT NULL DEFAULT 0,
  cantidad_merma    INTEGER NOT NULL DEFAULT 0,
  precio_unitario   NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_vendido     NUMERIC(10,2),
  fecha             DATE NOT NULL DEFAULT CURRENT_DATE,
  cerrado           BOOLEAN DEFAULT false,
  creado_en         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sugerencias_produccion (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  sucursal_id  UUID NOT NULL REFERENCES sucursales(id),
  producto     VARCHAR(120) NOT NULL,
  stock_actual NUMERIC NOT NULL,
  stock_minimo NUMERIC NOT NULL,
  atendida     BOOLEAN NOT NULL DEFAULT false,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Auditoría de cambios de precio (productos e insumos) ─────────
CREATE TABLE IF NOT EXISTS auditoria_precios (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  tipo                  VARCHAR(20) NOT NULL CHECK (tipo IN ('producto', 'insumo')),
  entidad_id            UUID NOT NULL,
  entidad_nombre        VARCHAR(120) NOT NULL,
  campo                 VARCHAR(30) NOT NULL DEFAULT 'precio',
  valor_anterior        NUMERIC(12,4),
  valor_anterior_texto  VARCHAR(120),
  valor_nuevo           NUMERIC(12,4) NOT NULL,
  valor_nuevo_texto     VARCHAR(120),
  metodo                VARCHAR(20) NOT NULL DEFAULT 'individual'
                          CHECK (metodo IN ('individual', 'masivo_lista', 'masivo_porcentaje', 'compras')),
  porcentaje_aplicado   NUMERIC(6,2),
  ip_origen             VARCHAR(45),
  creado_en             TIMESTAMPTZ DEFAULT NOW()
);

-- ── Bitácora de actividad de usuarios ─────────────────────────────
CREATE TABLE IF NOT EXISTS bitacora_actividades (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  usuario_nombre  VARCHAR(120) NOT NULL,
  usuario_email   VARCHAR(100) NOT NULL,
  modulo          VARCHAR(40) NOT NULL,
  accion          VARCHAR(60) NOT NULL,
  descripcion     TEXT NOT NULL,
  detalles        JSONB,
  ip_origen       VARCHAR(45),
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Uso de IA: consumo de tokens y límite mensual por plan ────────
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id            SERIAL PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actividad_heartbeats (
  id          SERIAL PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  usuario_id  UUID,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uso_ia_mensual (
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  anio_mes        VARCHAR(7) NOT NULL,
  mensajes_usados INTEGER NOT NULL DEFAULT 0,
  actualizado_en  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, anio_mes)
);

-- ── CRM de WhatsApp: clientes, mensajes y pedidos ─────────────────
CREATE TABLE IF NOT EXISTS clientes_whatsapp (
  id                    SERIAL PRIMARY KEY,
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  telefono              VARCHAR(30) NOT NULL,
  nombre                TEXT,
  notas                 TEXT,
  primera_interaccion   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_interaccion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, telefono)
);

CREATE TABLE IF NOT EXISTS mensajes_whatsapp (
  id          SERIAL PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  cliente_id  INTEGER NOT NULL REFERENCES clientes_whatsapp(id) ON DELETE CASCADE,
  rol         VARCHAR(10) NOT NULL,
  contenido   TEXT NOT NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedidos_whatsapp (
  id                SERIAL PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  cliente_id        INTEGER NOT NULL REFERENCES clientes_whatsapp(id) ON DELETE CASCADE,
  items             JSONB NOT NULL DEFAULT '[]',
  total             NUMERIC,
  direccion         TEXT,
  estado            VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  tipo_entrega      VARCHAR(20) NOT NULL DEFAULT 'inmediato',
  fecha_programada  TIMESTAMPTZ,
  notificado_listo  BOOLEAN NOT NULL DEFAULT false,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_usuarios_tenant              ON usuarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email                ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_productos_tenant              ON productos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recetas_tenant                ON recetas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ingredientes_tenant           ON ingredientes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ingredientes_receta           ON ingredientes(receta_id);
CREATE INDEX IF NOT EXISTS idx_costeos_tenant                ON costeos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_costeos_producto               ON costeos(producto);
CREATE INDEX IF NOT EXISTS idx_costeos_creado_en              ON costeos(creado_en DESC);
CREATE UNIQUE INDEX IF NOT EXISTS inventario_nombre_normalizado_tenant_idx
  ON inventario(tenant_id, lower(trim(regexp_replace(nombre, '\s+', ' ', 'g'))));
CREATE INDEX IF NOT EXISTS idx_inventario_tenant              ON inventario(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_terminado_sucursal          ON inventario_terminado(tenant_id, sucursal_id);
CREATE INDEX IF NOT EXISTS idx_facturas_tenant                ON facturas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha                 ON facturas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_factura_items_tenant           ON factura_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ventas_tenant_fecha            ON ventas(tenant_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_creado_en               ON ventas(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_sucursal                ON ventas(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_venta_items_tenant              ON venta_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_venta_items_venta               ON venta_items(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_items_producto            ON venta_items(producto);
CREATE INDEX IF NOT EXISTS idx_sucursales_tenant               ON sucursales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lotes_tenant_fecha              ON lotes(tenant_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_lote_dist_lote                  ON lote_distribuciones(lote_id);
CREATE INDEX IF NOT EXISTS idx_lote_dist_sucursal               ON lote_distribuciones(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_caja_produccion_lote            ON caja_produccion(lote_id);
CREATE INDEX IF NOT EXISTS idx_caja_produccion_tenant          ON caja_produccion(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sugerencias_produccion_pendientes
  ON sugerencias_produccion(tenant_id, sucursal_id, producto, atendida);
CREATE INDEX IF NOT EXISTS idx_auditoria_precios_tenant        ON auditoria_precios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_precios_entidad       ON auditoria_precios(entidad_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_precios_creado        ON auditoria_precios(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_tenant_creado          ON bitacora_actividades(tenant_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_tenant             ON ai_usage_log(tenant_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_actividad_heartbeats_tenant     ON actividad_heartbeats(tenant_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_uso_ia_mensual_tenant           ON uso_ia_mensual(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pagos_variables_usuario         ON pagos_variables(usuario_id, mes DESC);
CREATE INDEX IF NOT EXISTS idx_mensajes_whatsapp_cliente       ON mensajes_whatsapp(cliente_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_pedidos_whatsapp_cliente        ON pedidos_whatsapp(cliente_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_pedidos_whatsapp_tenant_estado  ON pedidos_whatsapp(tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_whatsapp_programada
  ON pedidos_whatsapp(fecha_programada) WHERE tipo_entrega = 'agendado';

-- ── Función: actualizar timestamp automáticamente ─────────────
-- NOTA: en producción, esta función/trigger solo está enganchada a
-- config_fiscal y tenants — recetas/inventario/productos/
-- configuracion_costeo actualizan actualizado_en manualmente desde
-- el código de la ruta (ver backend/src/routes/*.js), no vía trigger.
-- Se documenta así deliberadamente para no divergir del comportamiento
-- real; si se agrega el trigger a más tablas, hacerlo también acá.
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.actualizado_en = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_config_fiscal_ts
  BEFORE UPDATE ON config_fiscal
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE OR REPLACE TRIGGER trg_tenants_ts
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
