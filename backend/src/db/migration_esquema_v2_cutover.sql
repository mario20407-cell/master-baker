-- ============================================================
-- Master Baker — Fase 2: cutover (rename real)
--
-- Requiere que _v2 ya esté creado, migrado y validado (Fase 1 /
-- pasos 2-4 de la Fase 2). Deja las tablas viejas como
-- *_old_backup_20260709 — NO se eliminan aquí, se conservan
-- 30 días.
--
-- IMPORTANTE: ya existía un `inventario_old_backup` /
-- `recetas_old_backup` / `ingredientes_old_backup` real, de una
-- migración anterior (esquema pre-_v2, con columnas como
-- `alerta_enviada_en` que ya no existen hoy). Por eso el backup
-- de ESTE cutover usa un sufijo con fecha — no debe pisar ese
-- backup previo, que queda intacto para que se decida aparte
-- qué hacer con él.
-- ============================================================

BEGIN;

-- ── Liberar nombres de índice de primary key ─────────────────
-- El backup previo (sin fecha, de una migración anterior) usa
-- los nombres LIMPIOS *_pkey (porque esas tablas eran
-- originalmente "inventario"/"recetas"/"ingredientes" antes de
-- ese cutover pasado). Los nombres de índice son únicos por
-- esquema en Postgres, así que hay que liberarlos antes de
-- poder reusarlos en las tablas que estamos por promover.
ALTER INDEX inventario_pkey RENAME TO inventario_old_backup_pkey;
ALTER INDEX recetas_pkey RENAME TO recetas_old_backup_pkey;
ALTER INDEX ingredientes_pkey RENAME TO ingredientes_old_backup_pkey;

-- ── Rename de tablas ─────────────────────────────────────────
ALTER TABLE inventario RENAME TO inventario_old_backup_20260709;
ALTER TABLE inventario_v2 RENAME TO inventario;

ALTER TABLE recetas RENAME TO recetas_old_backup_20260709;
ALTER TABLE recetas_v2 RENAME TO recetas;

ALTER TABLE ingredientes RENAME TO ingredientes_old_backup_20260709;
ALTER TABLE ingredientes_v2 RENAME TO ingredientes;

-- ── Limpieza de nombres de constraints/índices ──────────────
-- Las tablas _v2 recién creadas chocaron en nombre con las
-- tablas viejas (que ya usaban sufijo _v2_* desde antes de esta
-- migración) y Postgres les puso "1" al final automáticamente.
-- Ahora que "inventario"/"recetas"/"ingredientes" son las tablas
-- _v2 renombradas, dejamos sus constraints/índices con nombres
-- limpios (sin "_v2" ni "1" residual).

ALTER TABLE inventario RENAME CONSTRAINT inventario_v2_pkey1 TO inventario_pkey;
ALTER TABLE inventario RENAME CONSTRAINT inventario_v2_tenant_id_fkey TO inventario_tenant_id_fkey;
ALTER INDEX inventario_v2_tenant_id_lower_idx RENAME TO inventario_nombre_normalizado_tenant_idx;

ALTER TABLE recetas RENAME CONSTRAINT recetas_v2_pkey1 TO recetas_pkey;
ALTER TABLE recetas RENAME CONSTRAINT recetas_v2_tenant_id_fkey TO recetas_tenant_id_fkey;
ALTER TABLE recetas RENAME CONSTRAINT recetas_v2_tenant_id_producto_fkey TO recetas_tenant_id_producto_fkey;
ALTER TABLE recetas RENAME CONSTRAINT recetas_v2_tenant_id_producto_key1 TO recetas_tenant_id_producto_key;

ALTER TABLE ingredientes RENAME CONSTRAINT ingredientes_v2_pkey1 TO ingredientes_pkey;
ALTER TABLE ingredientes RENAME CONSTRAINT ingredientes_v2_tenant_id_fkey TO ingredientes_tenant_id_fkey;
ALTER TABLE ingredientes RENAME CONSTRAINT ingredientes_v2_receta_id_fkey TO ingredientes_receta_id_fkey;
ALTER TABLE ingredientes RENAME CONSTRAINT ingredientes_v2_tipo_check TO ingredientes_tipo_check;

-- Nota: las tablas *_old_backup_20260709 conservan sus nombres
-- de constraint/índice actuales tal cual (ya decían "_v2_*"
-- desde antes de esta migración). Son temporales, se eliminan
-- junto con las tablas en 30 días — no vale la pena tocarlas.
-- El backup previo (inventario_old_backup / recetas_old_backup /
-- ingredientes_old_backup, sin fecha) tampoco se toca aquí.

COMMIT;
