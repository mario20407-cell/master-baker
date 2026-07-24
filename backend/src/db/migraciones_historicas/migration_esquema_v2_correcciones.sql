-- ============================================================
-- Master Baker — Fase 1: correcciones puntuales post-migración
--
-- Detectadas al revisar ingredientes con precio 0 en las recetas
-- migradas a _v2 (staging). Ver conversación de Fase 1 para el
-- criterio de cada caso.
-- ============================================================

-- "Harina" en "Pico de queso" no tenía precio (0) — dato faltante,
-- no un caso de costo cero intencional. Se corrige con el costo
-- unitario real de inventario_v2 (mismas unidades: g).
UPDATE ingredientes_v2 i
SET precio = (SELECT costo_unitario FROM inventario_v2 WHERE nombre = 'Harina')
FROM recetas_v2 r
WHERE r.id = i.receta_id
  AND r.producto = 'Pico de queso'
  AND i.nombre = 'Harina';

-- "Gas" en "Dona azucarada" es un ingrediente tipo indirecto con
-- precio 0 a propósito: el costo de gas ya se cubre globalmente
-- vía configuracion_costeo (costo_indirecto_gas), así que tenerlo
-- también aquí en cero (no con un precio propio) evita doble conteo.
UPDATE ingredientes_v2 i
SET costo_cero_intencional = true
FROM recetas_v2 r
WHERE r.id = i.receta_id
  AND r.producto = 'Dona azucarada'
  AND i.nombre = 'Gas';

-- Recalcular el snapshot de recetas_v2 afectado por el cambio de
-- precio de Harina (misma fórmula que migration_esquema_v2_datos.sql).
WITH costos_ingredientes AS (
  SELECT
    receta_id,
    SUM(cantidad * precio) FILTER (WHERE tipo <> 'indirecto') AS costo_directo,
    SUM(cantidad * precio) FILTER (WHERE tipo = 'indirecto')  AS costo_indirecto_ingredientes
  FROM ingredientes_v2
  GROUP BY receta_id
)
UPDATE recetas_v2 r
SET
  costo_directo = COALESCE(ci.costo_directo, 0),
  costo_indirecto = COALESCE(ci.costo_indirecto_ingredientes, 0)
    + COALESCE(cc.costo_indirecto_gas, 0)
    + COALESCE(cc.costo_indirecto_luz, 0)
    + COALESCE(cc.costo_indirecto_mano, 0),
  margen_aplicado = CASE WHEN r.margen_aplicado IS NOT NULL AND r.margen_aplicado <> 0
                         THEN r.margen_aplicado
                         ELSE COALESCE(cc.margen_objetivo, 57.00) END,
  precio_sugerido = CASE
    WHEN r.piezas > 0 AND (r.piezas * (1 - COALESCE(r.merma_pct, 0) / 100.0)) > 0
      AND (CASE WHEN r.margen_aplicado IS NOT NULL AND r.margen_aplicado <> 0 THEN r.margen_aplicado ELSE COALESCE(cc.margen_objetivo, 57.00) END) / 100.0 < 1
    THEN
      ((COALESCE(ci.costo_directo, 0)
        + COALESCE(ci.costo_indirecto_ingredientes, 0)
        + COALESCE(cc.costo_indirecto_gas, 0)
        + COALESCE(cc.costo_indirecto_luz, 0)
        + COALESCE(cc.costo_indirecto_mano, 0))
       / (r.piezas * (1 - COALESCE(r.merma_pct, 0) / 100.0)))
      / (1 - (CASE WHEN r.margen_aplicado IS NOT NULL AND r.margen_aplicado <> 0 THEN r.margen_aplicado ELSE COALESCE(cc.margen_objetivo, 57.00) END) / 100.0)
    WHEN r.piezas > 0 AND (r.piezas * (1 - COALESCE(r.merma_pct, 0) / 100.0)) > 0
    THEN
      (COALESCE(ci.costo_directo, 0)
        + COALESCE(ci.costo_indirecto_ingredientes, 0)
        + COALESCE(cc.costo_indirecto_gas, 0)
        + COALESCE(cc.costo_indirecto_luz, 0)
        + COALESCE(cc.costo_indirecto_mano, 0))
      / (r.piezas * (1 - COALESCE(r.merma_pct, 0) / 100.0))
    ELSE 0
  END
FROM recetas_v2 r0
LEFT JOIN costos_ingredientes ci ON ci.receta_id = r0.id
LEFT JOIN configuracion_costeo cc ON cc.tenant_id = r0.tenant_id
WHERE r.id = r0.id AND r0.producto = 'Pico de queso';
