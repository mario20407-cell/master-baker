// Lógica compartida entre produccion.js, inventario-terminado.js y ventas.js
// para no triplicar la distribución de lotes ni la detección de stock bajo.

// Reparte un lote entre sucursales: registra lote_distribuciones y suma a inventario_terminado.
// `lote` debe traer { id, producto, unidad, cantidad } ya cargado por el caller.
export async function distribuirLote(client, tenantId, lote, distribuciones) {
  const totalDist = distribuciones.reduce((s, d) => s + Number(d.cantidad), 0)
  if (totalDist > lote.cantidad) {
    throw Object.assign(
      new Error(`Total distribuido (${totalDist}) supera la producción del lote (${lote.cantidad})`),
      { status: 400 }
    )
  }

  const registros = []
  for (const dist of distribuciones) {
    await client.query(
      `INSERT INTO lote_distribuciones (tenant_id, lote_id, sucursal_id, cantidad)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (lote_id, sucursal_id) DO UPDATE SET cantidad = lote_distribuciones.cantidad + EXCLUDED.cantidad`,
      [tenantId, lote.id, dist.sucursal_id, dist.cantidad]
    )
    const inv = await client.query(
      `INSERT INTO inventario_terminado (tenant_id, sucursal_id, producto, stock, unidad)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (tenant_id, sucursal_id, producto)
       DO UPDATE SET stock = inventario_terminado.stock + EXCLUDED.stock,
                     actualizado_en = NOW()
       RETURNING *`,
      [tenantId, dist.sucursal_id, lote.producto, dist.cantidad, lote.unidad]
    )
    registros.push(inv.rows[0])
  }
  return registros
}

// Crea una sugerencia de reposición si stockActual < stockMinimo y no hay ya
// una sin atender para la misma combinación tenant+sucursal+producto (evita duplicados).
export async function verificarSugerencia(client, tenantId, sucursalId, producto, stockActual, stockMinimo) {
  if (stockActual >= stockMinimo) return null

  const { rows: existentes } = await client.query(
    `SELECT id FROM sugerencias_produccion
     WHERE tenant_id = $1 AND sucursal_id = $2 AND producto = $3 AND atendida = false`,
    [tenantId, sucursalId, producto]
  )
  if (existentes.length > 0) return null

  const { rows: [sugerencia] } = await client.query(
    `INSERT INTO sugerencias_produccion (tenant_id, sucursal_id, producto, stock_actual, stock_minimo)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [tenantId, sucursalId, producto, stockActual, stockMinimo]
  )
  return sugerencia
}
