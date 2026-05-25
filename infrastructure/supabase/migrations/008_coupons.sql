-- Coupons & Shipping config schema

-- ============================================================
-- Coupons
-- ============================================================
CREATE TYPE coupon_type AS ENUM ('percentage', 'fixed');

CREATE TABLE coupons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  type            coupon_type NOT NULL DEFAULT 'percentage',
  value           NUMERIC(10,2) NOT NULL,

  min_purchase    NUMERIC(10,2) DEFAULT 0,
  max_uses        INTEGER DEFAULT 0,  -- 0 = unlimited
  used_count      INTEGER DEFAULT 0,
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organization_id, code)
);

CREATE INDEX idx_coupons_org ON coupons(organization_id);
CREATE INDEX idx_coupons_code ON coupons(organization_id, code) WHERE is_active = true;

-- ============================================================
-- Shipping Configs
-- ============================================================
CREATE TABLE shipping_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_order_free  NUMERIC(10,2) DEFAULT 0,
  estimated_days  INTEGER,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_shipping_org ON shipping_configs(organization_id);

-- ============================================================
-- Plans
-- ============================================================
CREATE TYPE plan_name AS ENUM ('starter', 'growth', 'pro', 'enterprise');

CREATE TABLE plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  plan              plan_name NOT NULL DEFAULT 'starter',
  stripe_subscription_id TEXT,
  stripe_price_id        TEXT,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trial')),
  trial_ends_at     TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organization_id)
);

CREATE INDEX idx_plans_org ON plans(organization_id);
CREATE INDEX idx_plans_status ON plans(status);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupons_org_access" ON coupons FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "shipping_org_access" ON shipping_configs FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "plans_org_access" ON plans FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
