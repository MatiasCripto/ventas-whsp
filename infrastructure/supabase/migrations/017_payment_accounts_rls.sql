-- 017_payment_accounts_rls.sql
-- Add RLS policies to payment_accounts table
-- Without these, anon key (fallback for createServiceClient) gets "permission denied" on all queries

-- Ensure RLS is enabled (default for new tables, but idempotent)
ALTER TABLE payment_accounts ENABLE ROW LEVEL SECURITY;

-- Allow SELECT — needed by dashboard (GET) and webhook (getStorePaymentSettings)
DROP POLICY IF EXISTS "anon_select_payment_accounts" ON payment_accounts;
CREATE POLICY "anon_select_payment_accounts" ON payment_accounts
  FOR SELECT USING (true);

-- Allow INSERT — needed by dashboard (POST)
DROP POLICY IF EXISTS "anon_insert_payment_accounts" ON payment_accounts;
CREATE POLICY "anon_insert_payment_accounts" ON payment_accounts
  FOR INSERT WITH CHECK (true);

-- Allow UPDATE — needed by dashboard (POST upsert) and DELETE deactivation
DROP POLICY IF EXISTS "anon_update_payment_accounts" ON payment_accounts;
CREATE POLICY "anon_update_payment_accounts" ON payment_accounts
  FOR UPDATE USING (true) WITH CHECK (true);

-- Allow DELETE — needed by dashboard (DELETE)
DROP POLICY IF EXISTS "anon_delete_payment_accounts" ON payment_accounts;
CREATE POLICY "anon_delete_payment_accounts" ON payment_accounts
  FOR DELETE USING (true);

-- ── Table-level GRANTs (table created after 009_rls_policies.sql ran) ──
GRANT SELECT ON TABLE payment_accounts TO anon;
GRANT ALL ON TABLE payment_accounts TO authenticated;
GRANT ALL ON TABLE payment_accounts TO service_role;
