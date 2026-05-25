-- Analytics schema

-- ============================================================
-- Customer Scores (RFM analysis)
-- ============================================================
CREATE TYPE rfm_segment AS ENUM ('champion', 'loyal', 'at_risk', 'new_customer', 'dormant', 'lost');
CREATE TYPE churn_risk AS ENUM ('low', 'medium', 'high', 'churned');

CREATE TABLE customer_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID REFERENCES customers(id) ON DELETE CASCADE,
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,

  total_orders      INTEGER DEFAULT 0,
  total_spent       NUMERIC(10,2) DEFAULT 0,
  avg_ticket        NUMERIC(10,2) DEFAULT 0,

  recency_days      INTEGER,  -- days since last order
  frequency_count   INTEGER,  -- orders in last 90 days
  monetary_value    NUMERIC(10,2),  -- total spent in last 90 days

  rfm_segment       rfm_segment,
  churn_risk        churn_risk,
  ltv_estimated     NUMERIC(10,2),

  preferred_categories TEXT[] DEFAULT '{}',
  preferred_sizes     TEXT[] DEFAULT '{}',

  computed_at       TIMESTAMPTZ DEFAULT now(),

  UNIQUE(customer_id)
);

CREATE INDEX idx_customer_scores_org ON customer_scores(organization_id);
CREATE INDEX idx_customer_scores_segment ON customer_scores(rfm_segment);
CREATE INDEX idx_customer_scores_churn ON customer_scores(churn_risk);

-- ============================================================
-- Daily Analytics
-- ============================================================
CREATE TABLE analytics_daily (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  store_id          UUID REFERENCES stores(id) ON DELETE CASCADE,

  date              DATE NOT NULL,

  total_orders      INTEGER DEFAULT 0,
  total_revenue     NUMERIC(10,2) DEFAULT 0,
  avg_order_value   NUMERIC(10,2) DEFAULT 0,

  new_customers     INTEGER DEFAULT 0,
  returning_customers INTEGER DEFAULT 0,

  top_products      JSONB DEFAULT '{}',
  top_categories    JSONB DEFAULT '{}',
  conversion_rate   NUMERIC(5,2) DEFAULT 0,
  abandoned_carts   INTEGER DEFAULT 0,

  UNIQUE(store_id, date)
);

CREATE INDEX idx_analytics_org ON analytics_daily(organization_id);
CREATE INDEX idx_analytics_store_date ON analytics_daily(store_id, date DESC);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE customer_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_scores_org_access" ON customer_scores FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "analytics_daily_org_access" ON analytics_daily FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
