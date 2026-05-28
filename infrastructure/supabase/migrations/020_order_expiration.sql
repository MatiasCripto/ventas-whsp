-- 020_order_expiration.sql
-- Order expiration system with configurable per-org settings.

-- ============================================================
-- 1. Add 'expired' to order_status enum (must be outside txn)
-- ============================================================
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'expired';

-- ============================================================
-- 2. Expiration settings (per organization)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_expiration_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) UNIQUE,
  enabled               BOOLEAN DEFAULT true,
  expiration_minutes    INTEGER NOT NULL DEFAULT 60,
  auto_release_stock    BOOLEAN DEFAULT true,
  reminder_1_minutes    INTEGER,     -- NULL = disabled
  reminder_2_minutes    INTEGER,     -- NULL = disabled
  reminder_final_minutes INTEGER,    -- NULL = disabled
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expiration_settings_org
  ON order_expiration_settings(organization_id);

-- ============================================================
-- 3. Default settings trigger: auto-create on org INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION auto_create_expiration_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO order_expiration_settings (organization_id)
  VALUES (NEW.id)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_expiration_settings ON organizations;
CREATE TRIGGER trg_auto_create_expiration_settings
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_expiration_settings();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE order_expiration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_read_expiration_settings" ON order_expiration_settings
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "org_insert_expiration_settings" ON order_expiration_settings
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "org_update_expiration_settings" ON order_expiration_settings
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Grants
GRANT SELECT ON TABLE order_expiration_settings TO anon;
GRANT ALL ON TABLE order_expiration_settings TO authenticated;
GRANT ALL ON TABLE order_expiration_settings TO service_role;
