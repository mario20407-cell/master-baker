-- Email único por negocio, no global (D6, deuda técnica).
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_email_key;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_tenant_email_key UNIQUE (tenant_id, email);
