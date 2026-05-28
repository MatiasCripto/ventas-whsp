-- 016_payment_accounts.sql
-- Payment accounts table + order status enum updates for payment lifecycle

-- ── Extend order_status enum with new payment lifecycle statuses ──
DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_payment';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'payment_under_review';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'payment_confirmed';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'payment_rejected';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'completed';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'refunded';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── Extend payment_status enum ──
DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'awaiting';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'under_review';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'confirmed';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── payment_accounts (simplified per-store bank config) ──────────
CREATE TABLE IF NOT EXISTS payment_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  bank_name       TEXT NOT NULL,
  account_holder  TEXT NOT NULL,
  alias           TEXT,
  cvu             TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_accounts_org ON payment_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_active ON payment_accounts(is_active);

-- ── Add review_note to payment_proofs (only if table exists) ─────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'payment_proofs') THEN
    ALTER TABLE payment_proofs ADD COLUMN IF NOT EXISTS review_note TEXT;
  END IF;
END $$;
