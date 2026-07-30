-- RLS defensivo por tenant_id (R2, deuda técnica). Ver nota extensa en
-- schema.sql sobre por qué esto hoy no cambia nada en la práctica.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'usuarios','pagos_variables','sucursales','productos','recetas','ingredientes',
    'costeos','inventario','inventario_terminado','facturas','factura_items',
    'config_fiscal','configuracion_costeo','ventas','venta_items','ordenes_produccion',
    'lotes','lote_distribuciones','caja_produccion','sugerencias_produccion',
    'auditoria_precios','bitacora_actividades','ai_usage_log','actividad_heartbeats',
    'uso_ia_mensual','clientes_whatsapp','mensajes_whatsapp','pedidos_whatsapp',
    'tenant_whatsapp_config'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)',
      t
    );
  END LOOP;
END $$;
