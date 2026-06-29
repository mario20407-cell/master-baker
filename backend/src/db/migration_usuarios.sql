-- Migración: tabla usuarios + columna password_hash
-- Correr en producción si la tabla no existe aún

CREATE TABLE IF NOT EXISTS usuarios (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  email          VARCHAR(120) NOT NULL,
  password_hash  TEXT,
  nombre         VARCHAR(120) NOT NULL,
  rol            VARCHAR(30) NOT NULL DEFAULT 'operario',
  activo         BOOLEAN DEFAULT true,
  ultimo_login   TIMESTAMPTZ,
  creado_en      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

-- Si la tabla ya existía sin password_hash, agregar la columna
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Insertar admin si no existe (sin password — usar set-admin-password.js para el hash)
INSERT INTO usuarios (tenant_id, email, nombre, rol)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin@marquez.com', 'Administrador', 'admin')
ON CONFLICT (tenant_id, email) DO NOTHING;
