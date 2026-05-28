-- RLS write policies (UPDATE, INSERT, DELETE) + low_stock_threshold + storage policies
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. Fix: current_user_org_id() needs SECURITY DEFINER to avoid recursion
-- ============================================================
CREATE OR REPLACE FUNCTION current_user_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- 2. Add low_stock_threshold to products
-- ============================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5;

-- ============================================================
-- 3. Product images bucket policies
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their org's folder
CREATE POLICY "product_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow anyone to read public images
CREATE POLICY "product_images_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

-- Allow authenticated users to update/delete their own org's images
CREATE POLICY "product_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "product_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 4. Write policies for all core tables
-- ============================================================

-- Helper: check org membership (uses SECURITY DEFINER function above)
-- Products
CREATE POLICY "products_insert" ON products
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

CREATE POLICY "products_update" ON products
  FOR UPDATE TO authenticated
  USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

CREATE POLICY "products_delete" ON products
  FOR DELETE TO authenticated
  USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

-- Product Variants
CREATE POLICY "product_variants_insert" ON product_variants
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variants.product_id
      AND products.organization_id = current_user_org_id()
    )
  );

CREATE POLICY "product_variants_update" ON product_variants
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variants.product_id
      AND products.organization_id = current_user_org_id()
    )
  );

CREATE POLICY "product_variants_delete" ON product_variants
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variants.product_id
      AND products.organization_id = current_user_org_id()
    )
  );

-- Categories
CREATE POLICY "categories_insert" ON categories
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

CREATE POLICY "categories_update" ON categories
  FOR UPDATE TO authenticated
  USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

CREATE POLICY "categories_delete" ON categories
  FOR DELETE TO authenticated
  USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

-- Customers
CREATE POLICY "customers_insert" ON customers
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

CREATE POLICY "customers_update" ON customers
  FOR UPDATE TO authenticated
  USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

-- Orders
CREATE POLICY "orders_insert" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

CREATE POLICY "orders_update" ON orders
  FOR UPDATE TO authenticated
  USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

-- Order items
CREATE POLICY "order_items_insert" ON order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.organization_id = current_user_org_id()
    )
  );

-- Conversations
CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE TO authenticated
  USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

-- Messages
CREATE POLICY "messages_insert" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.organization_id = current_user_org_id()
    )
  );

-- Inventory movements
CREATE POLICY "inventory_movements_insert" ON inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.id = inventory_movements.variant_id
      AND p.organization_id = current_user_org_id()
    )
  );

-- Carts
CREATE POLICY "carts_insert" ON carts
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

CREATE POLICY "carts_update" ON carts
  FOR UPDATE TO authenticated
  USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

-- Cart items
CREATE POLICY "cart_items_insert" ON cart_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
      AND carts.organization_id = current_user_org_id()
    )
  );

-- ============================================================
-- 5. Grant permissions (safe to re-run)
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
