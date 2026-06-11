-- ============================================================
-- MIGRATION: 030_bridge_for_variant_generalization
-- Description: Prepares stores for variant generalization (031).
--   Ensures variant_attr1/variant_attr2 columns exist on stores
--   (originally added in 027) and adds default labels so that
--   the attr1/attr2 rename in 031 has the required store config.
-- ============================================================

-- 1. Ensure store variant attribute labels exist (idempotent)
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS variant_attr1 text DEFAULT 'Talle';
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS variant_attr2 text DEFAULT 'Color';

-- 2. Ensure organizations have matching attribute label settings
--    Used by getVariantAttrs() in src/lib/superadmin/utils.ts
--    for new org onboarding.
DO $$
BEGIN
  -- Add attr1Label/attr2Label to existing orgs that don't have them
  UPDATE organizations
  SET settings = jsonb_set(
    jsonb_set(
      COALESCE(settings::jsonb, '{}'::jsonb),
      '{attr1Label}',
      '"Talle"'::jsonb,
      true
    ),
    '{attr2Label}',
    '"Color"'::jsonb,
    true
  )
  WHERE settings IS NULL
     OR settings::jsonb->>'attr1Label' IS NULL;
END $$;
