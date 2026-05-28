-- 014_payment_lifecycle.sql
-- Payment settings per store, payment proofs, order lifecycle columns

-- ── store_payment_settings ────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  store_id UUID REFERENCES stores(id),
  bank_name TEXT,
  account_holder TEXT,
  alias TEXT,
  cvu TEXT,
  payment_notes TEXT,
  accepts_cash_on_delivery BOOLEAN DEFAULT false,
  accepts_pickup_payment BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── payment_proofs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  store_id UUID REFERENCES stores(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- ── Add columns to orders ─────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dni TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS locality TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "references" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS editable BOOLEAN DEFAULT true;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payment_proofs_order ON payment_proofs(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON payment_proofs(status);
CREATE INDEX IF NOT EXISTS idx_store_payment_settings_store ON store_payment_settings(store_id);
