-- 022_multi_payment_accounts.sql
-- Add multi-account support to payment_accounts table.

ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'transfer';
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS currency       TEXT DEFAULT 'ARS';
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS priority       INTEGER DEFAULT 0;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS instructions   TEXT;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS is_default     BOOLEAN DEFAULT false;

-- Index for finding the best account quickly
CREATE INDEX IF NOT EXISTS idx_payment_accounts_priority
  ON payment_accounts(organization_id, priority DESC)
  WHERE is_active = true;
