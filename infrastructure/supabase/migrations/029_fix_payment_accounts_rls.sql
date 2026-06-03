-- 029_fix_payment_accounts_rls.sql
-- Corrige las políticas RLS de payment_accounts.
-- Reemplaza USING(true) por policies scopeadas por organización.

-- ============================================================
-- 1. Eliminar políticas permisivas anteriores
-- ============================================================
DROP POLICY IF EXISTS "anon_select_payment_accounts" ON payment_accounts;
DROP POLICY IF EXISTS "anon_insert_payment_accounts" ON payment_accounts;
DROP POLICY IF EXISTS "anon_update_payment_accounts" ON payment_accounts;
DROP POLICY IF EXISTS "anon_delete_payment_accounts" ON payment_accounts;

-- ============================================================
-- 2. Nuevas políticas scopeadas por organización
-- ============================================================
CREATE POLICY "org_select_payment_accounts" ON payment_accounts
  FOR SELECT USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

CREATE POLICY "org_insert_payment_accounts" ON payment_accounts
  FOR INSERT WITH CHECK (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

CREATE POLICY "org_update_payment_accounts" ON payment_accounts
  FOR UPDATE USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

CREATE POLICY "org_delete_payment_accounts" ON payment_accounts
  FOR DELETE USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

-- ============================================================
-- 3. Grants mínimos necesarios
-- service_role necesita acceso completo (webhook + cron jobs)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_accounts TO service_role;
