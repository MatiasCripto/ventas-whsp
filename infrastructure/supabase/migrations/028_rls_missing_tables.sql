-- 028_rls_missing_tables.sql
-- Habilita RLS en tablas que no tenían políticas:
-- product_images, store_payment_settings, payment_proofs

-- ============================================================
-- 1. product_images (no tiene organization_id propio)
-- Se protege via JOIN a products
-- ============================================================
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_images_select" ON product_images FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_images.product_id
    AND products.organization_id = current_user_org_id()
  )
  AND current_user_org_id() IS NOT NULL
);

CREATE POLICY "product_images_insert" ON product_images FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_images.product_id
    AND products.organization_id = current_user_org_id()
  )
  AND current_user_org_id() IS NOT NULL
);

CREATE POLICY "product_images_update" ON product_images FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_images.product_id
    AND products.organization_id = current_user_org_id()
  )
  AND current_user_org_id() IS NOT NULL
);

CREATE POLICY "product_images_delete" ON product_images FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_images.product_id
    AND products.organization_id = current_user_org_id()
  )
  AND current_user_org_id() IS NOT NULL
);

-- ============================================================
-- 2. store_payment_settings (tiene organization_id)
-- ============================================================
ALTER TABLE store_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_payment_settings_select" ON store_payment_settings FOR SELECT USING (
  organization_id = current_user_org_id()
  AND current_user_org_id() IS NOT NULL
);

CREATE POLICY "store_payment_settings_insert" ON store_payment_settings FOR INSERT WITH CHECK (
  organization_id = current_user_org_id()
  AND current_user_org_id() IS NOT NULL
);

CREATE POLICY "store_payment_settings_update" ON store_payment_settings FOR UPDATE USING (
  organization_id = current_user_org_id()
  AND current_user_org_id() IS NOT NULL
);

CREATE POLICY "store_payment_settings_delete" ON store_payment_settings FOR DELETE USING (
  organization_id = current_user_org_id()
  AND current_user_org_id() IS NOT NULL
);

-- ============================================================
-- 3. payment_proofs (no tiene organization_id propio)
-- Se protege via JOIN a orders
-- ============================================================
ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_proofs_select" ON payment_proofs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = payment_proofs.order_id
    AND orders.organization_id = current_user_org_id()
  )
  AND current_user_org_id() IS NOT NULL
);

CREATE POLICY "payment_proofs_insert" ON payment_proofs FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = payment_proofs.order_id
    AND orders.organization_id = current_user_org_id()
  )
  AND current_user_org_id() IS NOT NULL
);

CREATE POLICY "payment_proofs_update" ON payment_proofs FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = payment_proofs.order_id
    AND orders.organization_id = current_user_org_id()
  )
  AND current_user_org_id() IS NOT NULL
);

CREATE POLICY "payment_proofs_delete" ON payment_proofs FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = payment_proofs.order_id
    AND orders.organization_id = current_user_org_id()
  )
  AND current_user_org_id() IS NOT NULL
);
