-- ============================================================
-- Master Baker — Fase 1: migración de datos a esquema _v2
--
-- SOLO corre esto contra `staging`, después de
-- migration_esquema_v2.sql. Recalcula el snapshot de costeo de
-- cada receta con la misma fórmula que usa el frontend
-- (Recetas.jsx / FormReceta): costo directo = suma de
-- ingredientes no indirectos, costo indirecto = configuración
-- global (gas+luz+mano del tenant) + ingredientes indirectos,
-- margen = el que ya tenía la receta si es distinto de 0/NULL,
-- si no el margen_objetivo de configuracion_costeo del tenant.
-- ============================================================

-- ── inventario_v2 ──────────────────────────────────────────
-- Nombre normalizado (trim + colapso de espacios). Ya se
-- confirmó que no hay colisiones de nombre normalizado en los
-- datos actuales, así que el índice único no debería fallar.
INSERT INTO inventario_v2 (
  id, tenant_id, nombre, existencia, unidad, consumo_diario,
  punto_reposicion, costo_unitario, densidad_g_ml, activo, actualizado_en
)
SELECT
  id, tenant_id,
  trim(regexp_replace(nombre, '\s+', ' ', 'g')) AS nombre,
  existencia, unidad, consumo_diario, punto_reposicion,
  costo_unitario, densidad_g_ml, activo, actualizado_en
FROM inventario;

-- ── recetas_v2 (con snapshot de costeo recalculado) ────────
WITH costos_ingredientes AS (
  SELECT
    receta_id,
    SUM(cantidad * precio) FILTER (WHERE tipo <> 'indirecto') AS costo_directo,
    SUM(cantidad * precio) FILTER (WHERE tipo = 'indirecto')  AS costo_indirecto_ingredientes
  FROM ingredientes
  GROUP BY receta_id
)
INSERT INTO recetas_v2 (
  id, tenant_id, producto, piezas, peso_por_pieza, merma_pct, notas,
  costo_directo, costo_indirecto, margen_aplicado, precio_sugerido,
  creado_en, actualizado_en
)
SELECT
  r.id, r.tenant_id, r.producto, r.piezas, r.peso_por_pieza, r.merma_pct, r.notas,
  COALESCE(ci.costo_directo, 0) AS costo_directo,
  COALESCE(ci.costo_indirecto_ingredientes, 0)
    + COALESCE(cc.costo_indirecto_gas, 0)
    + COALESCE(cc.costo_indirecto_luz, 0)
    + COALESCE(cc.costo_indirecto_mano, 0) AS costo_indirecto,
  CASE WHEN r.margen_aplicado IS NOT NULL AND r.margen_aplicado <> 0
       THEN r.margen_aplicado
       ELSE COALESCE(cc.margen_objetivo, 57.00)
  END AS margen_aplicado,
  -- precio_sugerido = costo_unitario / (1 - margen); costo_unitario = costo_total / piezas_efectivas
  CASE
    WHEN (CASE WHEN r.margen_aplicado IS NOT NULL AND r.margen_aplicado <> 0 THEN r.margen_aplicado ELSE COALESCE(cc.margen_objetivo, 57.00) END) / 100.0 < 1
      AND r.piezas > 0 AND (r.piezas * (1 - COALESCE(r.merma_pct, 0) / 100.0)) > 0
    THEN
      (
        (COALESCE(ci.costo_directo, 0)
          + COALESCE(ci.costo_indirecto_ingredientes, 0)
          + COALESCE(cc.costo_indirecto_gas, 0)
          + COALESCE(cc.costo_indirecto_luz, 0)
          + COALESCE(cc.costo_indirecto_mano, 0))
        / (r.piezas * (1 - COALESCE(r.merma_pct, 0) / 100.0))
      ) / (1 - (CASE WHEN r.margen_aplicado IS NOT NULL AND r.margen_aplicado <> 0 THEN r.margen_aplicado ELSE COALESCE(cc.margen_objetivo, 57.00) END) / 100.0)
    WHEN r.piezas > 0 AND (r.piezas * (1 - COALESCE(r.merma_pct, 0) / 100.0)) > 0
    THEN
      (COALESCE(ci.costo_directo, 0)
        + COALESCE(ci.costo_indirecto_ingredientes, 0)
        + COALESCE(cc.costo_indirecto_gas, 0)
        + COALESCE(cc.costo_indirecto_luz, 0)
        + COALESCE(cc.costo_indirecto_mano, 0))
      / (r.piezas * (1 - COALESCE(r.merma_pct, 0) / 100.0))
    ELSE 0
  END AS precio_sugerido,
  r.creado_en, r.actualizado_en
FROM recetas r
LEFT JOIN costos_ingredientes ci ON ci.receta_id = r.id
LEFT JOIN configuracion_costeo cc ON cc.tenant_id = r.tenant_id;

-- ── ingredientes_v2 ─────────────────────────────────────────
INSERT INTO ingredientes_v2 (
  id, tenant_id, receta_id, nombre, cantidad, unidad, precio, tipo,
  orden, costo_cero_intencional, subreceta_nombre, unidad_inventario, unidad_precio
)
SELECT
  id, tenant_id, receta_id, nombre, cantidad, unidad, precio, tipo,
  orden, COALESCE(costo_cero_intencional, false), subreceta_nombre, unidad_inventario, unidad_precio
FROM ingredientes;
