-- 027_superadmin.sql
-- Superadmin role + multi-tenant store management fields
--
-- IMPORTANTE: ALTER TYPE ... ADD VALUE no puede ejecutarse dentro de
-- una transacción en PostgreSQL. Se ejecuta FUERA de transacción.

-- Paso 1: Agregar el valor al ENUM (FUERA de transacción)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin';

-- Paso 2: Schema updates (dentro de transacción)
BEGIN;

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS evolution_instance text;

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS variant_attr1 text DEFAULT 'Talle';
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS variant_attr2 text DEFAULT 'Color';

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

COMMIT;
