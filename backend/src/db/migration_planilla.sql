-- ============================================================
-- Master Baker — Migración Planilla (nómina periódica)
-- Guarda un snapshot de la planilla generada cada período (salario
-- bruto, INSS laboral/patronal, INATEC, neto a pagar) por colaborador,
-- para poder consultar períodos anteriores en vez de recalcular
-- siempre "hoy". Soporta frecuencia semanal, quincenal o mensual —
-- la mayoría de colaboradores de panadería cobran semanal o quincenal,
-- no mensual.
-- Correr contra Supabase (SQL Editor) con acceso real a producción,
-- después de confirmar backup reciente. No la corre un agente de código.
-- ============================================================

CREATE TABLE IF NOT EXISTS planillas (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id),
  frecuencia           VARCHAR(10) NOT NULL DEFAULT 'mensual'
                         CHECK (frecuencia IN ('semanal', 'quincenal', 'mensual')),
  periodo_inicio       DATE NOT NULL,
  periodo_fin          DATE NOT NULL,
  generado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generado_por         UUID REFERENCES usuarios(id),
  empresa_grande       BOOLEAN NOT NULL DEFAULT false,
  total_bruto          NUMERIC NOT NULL DEFAULT 0,
  total_inss_laboral   NUMERIC NOT NULL DEFAULT 0,
  total_neto           NUMERIC NOT NULL DEFAULT 0,
  total_inss_patronal  NUMERIC NOT NULL DEFAULT 0,
  total_inatec         NUMERIC NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, periodo_inicio)
);

CREATE INDEX IF NOT EXISTS idx_planillas_tenant ON planillas(tenant_id);

CREATE TABLE IF NOT EXISTS planilla_detalle (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  planilla_id    UUID NOT NULL REFERENCES planillas(id) ON DELETE CASCADE,
  usuario_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre         VARCHAR(120) NOT NULL, -- snapshot: sobrevive si el colaborador se desactiva/borra después
  tipo_pago      VARCHAR(20) NOT NULL,
  salario_bruto  NUMERIC NOT NULL DEFAULT 0,
  inss_laboral   NUMERIC NOT NULL DEFAULT 0,
  neto_a_pagar   NUMERIC NOT NULL DEFAULT 0,
  inss_patronal  NUMERIC NOT NULL DEFAULT 0,
  inatec         NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_planilla_detalle_planilla ON planilla_detalle(planilla_id);
