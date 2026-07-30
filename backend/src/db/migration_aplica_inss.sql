-- ============================================================
-- Master Baker — Migración aplica_inss
-- Algunos tenants (panaderías informales que no cotizan al INSS/INATEC)
-- no deben ver deducciones ni cargas patronales que nunca pagan. Agrega
-- un switch por tenant en configuracion_costeo (default true — el
-- comportamiento legal esperado) y lo snapshotea en cada planilla
-- generada, para que si el tenant cambia el switch después, las
-- planillas viejas no cambien de interpretación retroactivamente.
-- Correr contra Supabase (SQL Editor) con acceso real a producción,
-- después de confirmar backup reciente. No la corre un agente de código.
-- ============================================================

ALTER TABLE configuracion_costeo ADD COLUMN IF NOT EXISTS aplica_inss BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE planillas ADD COLUMN IF NOT EXISTS aplica_inss BOOLEAN NOT NULL DEFAULT true;
