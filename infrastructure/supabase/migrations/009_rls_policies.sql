-- RLS policies for all core tables
-- Run this in Supabase SQL Editor after the full schema migration

-- Helper: get current user's organization_id (reusable)
CREATE OR REPLACE FUNCTION current_user_org_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- profiles
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_select_org" ON profiles
  FOR SELECT USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- organizations
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations_select" ON organizations
  FOR SELECT USING (
    id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

-- ============================================================
-- stores
-- ============================================================
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stores_select" ON stores
  FOR SELECT USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

-- ============================================================
-- categories
-- ============================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select" ON categories
  FOR SELECT USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

-- ============================================================
-- products
-- ============================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select" ON products
  FOR SELECT USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

-- ============================================================
-- product_variants
-- ============================================================
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_variants_select" ON product_variants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variants.product_id
      AND products.organization_id = current_user_org_id()
    )
    AND current_user_org_id() IS NOT NULL
  );



-- ============================================================
-- inventory_movements
-- ============================================================
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_movements_select" ON inventory_movements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.id = inventory_movements.variant_id
      AND p.organization_id = current_user_org_id()
    )
    AND current_user_org_id() IS NOT NULL
  );

-- ============================================================
-- customers
-- ============================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select" ON customers
  FOR SELECT USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

-- ============================================================
-- orders
-- ============================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select" ON orders
  FOR SELECT USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

-- ============================================================
-- order_items
-- ============================================================
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items_select" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.organization_id = current_user_org_id()
    )
    AND current_user_org_id() IS NOT NULL
  );

-- ============================================================
-- carts
-- ============================================================
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carts_select" ON carts
  FOR SELECT USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

-- ============================================================
-- cart_items
-- ============================================================
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cart_items_select" ON cart_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
      AND carts.organization_id = current_user_org_id()
    )
    AND current_user_org_id() IS NOT NULL
  );

-- ============================================================
-- conversations
-- ============================================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (
    organization_id = current_user_org_id()
    AND current_user_org_id() IS NOT NULL
  );

-- ============================================================
-- messages
-- ============================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.organization_id = current_user_org_id()
    )
    AND current_user_org_id() IS NOT NULL
  );

-- ============================================================
-- Grant permissions to anon and authenticated roles
-- (required after DROP SCHEMA public CASCADE)
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
