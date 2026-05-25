-- Customers schema

-- ============================================================
-- Customers
-- ============================================================
CREATE TABLE customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  store_id        UUID REFERENCES stores(id) ON DELETE SET NULL,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  notes           TEXT,
  whatsapp_id     TEXT,
  preferences     JSONB DEFAULT '{}',
  total_orders    INTEGER DEFAULT 0,
  lifetime_value  NUMERIC(10,2) DEFAULT 0,
  last_order_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organization_id, phone)
);

CREATE INDEX idx_customers_org ON customers(organization_id);
CREATE INDEX idx_customers_store ON customers(store_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_wp ON customers(whatsapp_id) WHERE whatsapp_id IS NOT NULL;
