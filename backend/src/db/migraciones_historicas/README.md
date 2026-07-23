# Migraciones históricas

Estos archivos ya fueron aplicados contra la base de datos de producción
(Supabase). Se conservan acá solo como registro histórico de cómo llegó
el esquema a su estado actual — **no hace falta correrlos de nuevo**.

La fuente de verdad vigente para instalaciones nuevas es
`backend/src/db/schema.sql` (consolidado el 2026-07-23 contra el esquema
real de producción vía `information_schema`).

No borrar estos archivos: documentan decisiones de diseño (por ejemplo,
por qué `ingredientes`/`inventario`/`recetas` pasaron por un cutover a
"v2" con tablas de respaldo `*_old_backup*` que hoy siguen existiendo en
producción pero ya no se usan y no están en `schema.sql`).
