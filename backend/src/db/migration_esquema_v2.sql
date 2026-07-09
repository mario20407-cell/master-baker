-- ============================================================
-- Master Baker — Fase 1: esquema nuevo en paralelo (_v2)
--
-- SOLO corre esto contra el ambiente `staging`. No es para
-- producción todavía — es la base para validar el cutover de
-- Inventario y Recetas antes de renombrar tablas (Fase 2).
--
-- NOTA IMPORTANTE: el esquema real de producción/staging ya
-- había evolucionado más allá de lo que describe schema.sql
-- (desactualizado). inventario.densidad_g_ml,
-- ingredientes.costo_cero_intencional y las columnas de
-- snapshot en recetas (costo_directo, costo_indirecto,
-- margen_aplicado, precio_sugerido) YA EXISTEN en las tablas
-- base — por eso este script las copia con
-- LIKE ... INCLUDING ALL en vez de agregarlas de nuevo.
-- configuracion_costeo también ya existe como tabla real
-- multi-tenant con datos correctos — no se toca.
-- ============================================================

-- ── inventario_v2 ──────────────────────────────────────────
CREATE TABLE inventario_v2 (LIKE inventario INCLUDING ALL);

ALTER TABLE inventario_v2
  ADD CONSTRAINT inventario_v2_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- NOTA: NO se agrega aquí un índice único global sobre el nombre
-- normalizado. La tabla base `inventario` ya trae uno correcto,
-- con alcance POR TENANT (tenant_id, lower(trim(regexp_replace(...))))
-- — ese índice se copia solo vía LIKE...INCLUDING ALL arriba.
-- Un índice único global (sin tenant_id) fue agregado por error en
-- un primer intento de este script y tuvo que revertirse: en un
-- sistema multi-tenant bloquearía que dos panaderías distintas
-- tuvieran ambas, por ejemplo, un insumo llamado "Harina".

-- ── recetas_v2 ──────────────────────────────────────────────
CREATE TABLE recetas_v2 (LIKE recetas INCLUDING ALL);

ALTER TABLE recetas_v2
  ADD CONSTRAINT recetas_v2_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE recetas_v2
  ADD CONSTRAINT recetas_v2_tenant_id_producto_fkey
  FOREIGN KEY (tenant_id, producto) REFERENCES productos(tenant_id, nombre) ON UPDATE CASCADE;

-- ── ingredientes_v2 ─────────────────────────────────────────
CREATE TABLE ingredientes_v2 (LIKE ingredientes INCLUDING ALL);

ALTER TABLE ingredientes_v2
  ADD CONSTRAINT ingredientes_v2_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE ingredientes_v2
  ADD CONSTRAINT ingredientes_v2_receta_id_fkey
  FOREIGN KEY (receta_id) REFERENCES recetas_v2(id) ON DELETE CASCADE;

-- NOTA: la tabla actual `ingredientes` NO tiene un FK hacia
-- `inventario` (el vínculo con inventario es por nombre en la
-- capa de aplicación, no una foreign key real) — por lo tanto
-- ingredientes_v2 tampoco lleva esa FK. Solo tenant_id y
-- receta_id son foreign keys reales hoy.

-- costo_cero_intencional llegó nullable desde el LIKE (así está
-- hoy en la tabla base). La tabla recién creada está vacía, así
-- que este UPDATE es un no-op ahora mismo, pero deja la columna
-- lista como NOT NULL antes de que entren datos en el paso de
-- migración de datos.
UPDATE ingredientes_v2 SET costo_cero_intencional = false WHERE costo_cero_intencional IS NULL;
ALTER TABLE ingredientes_v2 ALTER COLUMN costo_cero_intencional SET NOT NULL;
