-- ============================================================
-- FULL SCHEMA: Concierge AI — all 8 migrations combined
-- Run this once in Supabase SQL Editor
-- ============================================================

-- 001: Core schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  logo_url        TEXT,
  plan            TEXT DEFAULT 'starter',
  settings        JSONB DEFAULT '{}',
  trial_ends_at   TIMESTAMPTZ,
  trial_used      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'agent', 'viewer');

CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  role            user_role DEFAULT 'agent',
  avatar_url      TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_org ON profiles(organization_id);

CREATE TABLE stores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  address           TEXT,
  phone             TEXT,
  whatsapp_number   TEXT,
  timezone          TEXT DEFAULT 'America/Argentina/Buenos_Aires',
  settings          JSONB DEFAULT '{}',
  is_active         BOOLEAN DEFAULT true,
  evolution_instance TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stores_org ON stores(organization_id);
CREATE INDEX idx_stores_instance ON stores(evolution_instance) WHERE evolution_instance IS NOT NULL;

-- 002: Commerce schema
CREATE TABLE categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  parent_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
  image_url       TEXT,
  sort_order      INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_categories_org ON categories(organization_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand           TEXT,
  tags            TEXT[] DEFAULT '{}',
  price           NUMERIC(10,2) NOT NULL,
  compare_price   NUMERIC(10,2),
  images          TEXT[] DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  featured        BOOLEAN DEFAULT false,
  search_vector   TSVECTOR,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(organization_id) WHERE is_active = true;
CREATE INDEX idx_products_search ON products USING GIN(search_vector);
CREATE INDEX idx_products_tags ON products USING GIN(tags);
CREATE INDEX idx_products_name_trgm ON products USING GIN(name gin_trgm_ops);

-- Trigger to auto-update search_vector
CREATE OR REPLACE FUNCTION products_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('spanish',
    coalesce(NEW.name,'') || ' ' ||
    coalesce(NEW.description,'') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '),'')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_search
  BEFORE INSERT OR UPDATE OF name, description, tags ON products
  FOR EACH ROW EXECUTE FUNCTION products_search_update();

CREATE TABLE product_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  sku             TEXT,
  color           TEXT,
  size            TEXT,
  stock           INTEGER DEFAULT 0,
  price_override  NUMERIC(10,2),
  images          TEXT[] DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, color, size),
  UNIQUE(sku)
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;

CREATE TABLE product_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id  UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  url         TEXT NOT NULL,
  alt         TEXT,
  sort_order  INTEGER DEFAULT 0
);

CREATE INDEX idx_product_images_product ON product_images(product_id);

CREATE TYPE inventory_movement_type AS ENUM ('in', 'out', 'adjustment');

CREATE TABLE inventory_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id      UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity        INTEGER NOT NULL,
  type            inventory_movement_type NOT NULL,
  reference_type  TEXT,
  reference_id    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inventory_variant ON inventory_movements(variant_id);
CREATE INDEX idx_inventory_ref ON inventory_movements(reference_type, reference_id);

-- 008: Coupons (must come before 004)
CREATE TYPE coupon_type AS ENUM ('percentage', 'fixed');

CREATE TABLE coupons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  type            coupon_type NOT NULL DEFAULT 'percentage',
  value           NUMERIC(10,2) NOT NULL,
  min_purchase    NUMERIC(10,2) DEFAULT 0,
  max_uses        INTEGER DEFAULT 0,
  used_count      INTEGER DEFAULT 0,
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, code)
);

CREATE INDEX idx_coupons_org ON coupons(organization_id);
CREATE INDEX idx_coupons_code ON coupons(organization_id, code) WHERE is_active = true;

CREATE TABLE shipping_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_order_free  NUMERIC(10,2) DEFAULT 0,
  estimated_days  INTEGER,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_shipping_org ON shipping_configs(organization_id);

CREATE TYPE plan_name AS ENUM ('starter', 'growth', 'pro', 'enterprise');

CREATE TABLE plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  plan              plan_name NOT NULL DEFAULT 'starter',
  stripe_subscription_id TEXT,
  stripe_price_id        TEXT,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trial')),
  trial_ends_at     TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

CREATE INDEX idx_plans_org ON plans(organization_id);
CREATE INDEX idx_plans_status ON plans(status);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupons_org_access" ON coupons FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "shipping_org_access" ON shipping_configs FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "plans_org_access" ON plans FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 003: Customers
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

-- 004: Orders
CREATE TYPE order_status AS ENUM (
  'pending', 'confirmed', 'paid', 'preparing',
  'shipped', 'delivered', 'cancelled'
);

CREATE TYPE payment_status AS ENUM (
  'pending', 'paid', 'failed', 'refunded'
);

CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  store_id        UUID REFERENCES stores(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) NOT NULL,
  status          order_status DEFAULT 'pending',
  subtotal        NUMERIC(10,2) NOT NULL,
  shipping_cost   NUMERIC(10,2) DEFAULT 0,
  discount        NUMERIC(10,2) DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL,
  coupon_id       UUID REFERENCES coupons(id) ON DELETE SET NULL,
  payment_method  TEXT,
  payment_status  payment_status DEFAULT 'pending',
  payment_id      TEXT,
  shipping_method TEXT,
  shipping_address TEXT,
  estimated_days  INTEGER,
  tracking_number TEXT,
  tracking_url    TEXT,
  notes           TEXT,
  source          TEXT DEFAULT 'whatsapp',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_orders_org ON orders(organization_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_store ON orders(store_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID REFERENCES orders(id) ON DELETE CASCADE,
  variant_id    UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name  TEXT NOT NULL,
  variant_label TEXT,
  quantity      INTEGER NOT NULL,
  unit_price    NUMERIC(10,2) NOT NULL,
  total         NUMERIC(10,2) NOT NULL
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

CREATE TABLE carts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  session_id      TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id)
);

CREATE INDEX idx_carts_org ON carts(organization_id);
CREATE INDEX idx_carts_customer ON carts(customer_id);
CREATE INDEX idx_carts_session ON carts(session_id) WHERE session_id IS NOT NULL;

CREATE TABLE cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id     UUID REFERENCES carts(id) ON DELETE CASCADE,
  variant_id  UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1,
  added_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);

-- 005: Conversations
CREATE TYPE conversation_channel AS ENUM ('whatsapp', 'instagram', 'web');
CREATE TYPE conversation_status AS ENUM ('open', 'closed', 'bot', 'human');

CREATE TABLE conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) NOT NULL,
  store_id          UUID REFERENCES stores(id) ON DELETE SET NULL,
  customer_id       UUID REFERENCES customers(id) ON DELETE SET NULL,
  channel           conversation_channel DEFAULT 'whatsapp',
  channel_contact_id TEXT NOT NULL,
  channel_chat_id   TEXT NOT NULL,
  status            conversation_status DEFAULT 'open',
  context           JSONB DEFAULT '{}',
  human_takeover    BOOLEAN DEFAULT false,
  human_takeover_at TIMESTAMPTZ,
  human_takeover_reason TEXT,
  human_released_at TIMESTAMPTZ,
  last_message_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, channel, channel_chat_id)
);

CREATE INDEX idx_conversations_org ON conversations(organization_id);
CREATE INDEX idx_conversations_store ON conversations(store_id);
CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_conversations_contact ON conversations(channel_contact_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_last_msg ON conversations(last_message_at DESC NULLS LAST);

CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_type AS ENUM ('text', 'image', 'audio', 'video');

CREATE TABLE messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID REFERENCES conversations(id) ON DELETE CASCADE,
  channel_message_id  TEXT UNIQUE,
  direction           message_direction NOT NULL,
  type                message_type DEFAULT 'text',
  body                TEXT,
  media_url           TEXT,
  metadata            JSONB DEFAULT '{}',
  sent_at             TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sent ON messages(conversation_id, sent_at);

-- 006: Analytics
CREATE TYPE rfm_segment AS ENUM ('champion', 'loyal', 'at_risk', 'new_customer', 'dormant', 'lost');
CREATE TYPE churn_risk AS ENUM ('low', 'medium', 'high', 'churned');

CREATE TABLE customer_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID REFERENCES customers(id) ON DELETE CASCADE,
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  total_orders      INTEGER DEFAULT 0,
  total_spent       NUMERIC(10,2) DEFAULT 0,
  avg_ticket        NUMERIC(10,2) DEFAULT 0,
  recency_days      INTEGER,
  frequency_count   INTEGER,
  monetary_value    NUMERIC(10,2),
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

ALTER TABLE customer_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_scores_org_access" ON customer_scores FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "analytics_daily_org_access" ON analytics_daily FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 007: Automations
CREATE TABLE automation_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  store_id        UUID REFERENCES stores(id) ON DELETE SET NULL,
  workflow        TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('success', 'error')),
  payload         JSONB DEFAULT '{}',
  error           TEXT,
  executed_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_automation_logs_org ON automation_logs(organization_id);
CREATE INDEX idx_automation_logs_workflow ON automation_logs(workflow);
CREATE INDEX idx_automation_logs_entity ON automation_logs(entity_type, entity_id);
CREATE INDEX idx_automation_logs_executed ON automation_logs(executed_at DESC);

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_logs_org_access" ON automation_logs FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 002 (continued): Commerce RPC functions
CREATE OR REPLACE FUNCTION search_products_fts(
  query_text TEXT, org_id UUID, result_limit INTEGER DEFAULT 5
)
RETURNS TABLE(
  product_id UUID, name TEXT, slug TEXT, price NUMERIC, compare_price NUMERIC,
  images TEXT[], category_name TEXT, colors TEXT[], sizes TEXT[],
  stock BIGINT, score REAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.name, p.slug, p.price, p.compare_price, p.images,
    c.name,
    COALESCE((SELECT array_agg(DISTINCT pv.color) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true AND pv.color IS NOT NULL), '{}'),
    COALESCE((SELECT array_agg(DISTINCT pv.size) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true AND pv.size IS NOT NULL), '{}'),
    COALESCE((SELECT SUM(pv.stock) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true), 0),
    ts_rank(p.search_vector, plainto_tsquery('spanish', query_text))::REAL
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.organization_id = org_id
    AND p.is_active = true
    AND p.search_vector @@ plainto_tsquery('spanish', query_text)
  ORDER BY score DESC
  LIMIT result_limit;
END;
$$;

CREATE OR REPLACE FUNCTION search_products_trigram(
  search_terms TEXT[], org_id UUID, result_limit INTEGER DEFAULT 5
)
RETURNS TABLE(
  product_id UUID, name TEXT, slug TEXT, price NUMERIC, compare_price NUMERIC,
  images TEXT[], category_name TEXT, colors TEXT[], sizes TEXT[],
  stock BIGINT, score REAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (p.id)
    p.id, p.name, p.slug, p.price, p.compare_price, p.images,
    c.name,
    COALESCE((SELECT array_agg(DISTINCT pv.color) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true AND pv.color IS NOT NULL), '{}'),
    COALESCE((SELECT array_agg(DISTINCT pv.size) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true AND pv.size IS NOT NULL), '{}'),
    COALESCE((SELECT SUM(pv.stock) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true), 0),
    similarity(p.name, unnest(search_terms))::REAL
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id, unnest(search_terms) t
  WHERE p.organization_id = org_id
    AND p.is_active = true
    AND (similarity(p.name, t) > 0.2 OR similarity(coalesce(p.description,''), t) > 0.2)
  ORDER BY p.id, score DESC
  LIMIT result_limit;
END;
$$;

CREATE OR REPLACE FUNCTION search_products_by_tags(
  search_terms TEXT[], org_id UUID, result_limit INTEGER DEFAULT 5
)
RETURNS TABLE(
  product_id UUID, name TEXT, slug TEXT, price NUMERIC, compare_price NUMERIC,
  images TEXT[], category_name TEXT, colors TEXT[], sizes TEXT[],
  stock BIGINT, score REAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.name, p.slug, p.price, p.compare_price, p.images,
    c.name,
    COALESCE((SELECT array_agg(DISTINCT pv.color) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true AND pv.color IS NOT NULL), '{}'),
    COALESCE((SELECT array_agg(DISTINCT pv.size) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true AND pv.size IS NOT NULL), '{}'),
    COALESCE((SELECT SUM(pv.stock) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true), 0),
    0.8::REAL
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.organization_id = org_id
    AND p.is_active = true
    AND p.tags && search_terms
  ORDER BY p.name
  LIMIT result_limit;
END;
$$;

CREATE OR REPLACE FUNCTION search_products_by_category(
  search_terms TEXT[], org_id UUID, result_limit INTEGER DEFAULT 5
)
RETURNS TABLE(
  product_id UUID, name TEXT, slug TEXT, price NUMERIC, compare_price NUMERIC,
  images TEXT[], category_name TEXT, colors TEXT[], sizes TEXT[],
  stock BIGINT, score REAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.name, p.slug, p.price, p.compare_price, p.images,
    c.name,
    COALESCE((SELECT array_agg(DISTINCT pv.color) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true AND pv.color IS NOT NULL), '{}'),
    COALESCE((SELECT array_agg(DISTINCT pv.size) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true AND pv.size IS NOT NULL), '{}'),
    COALESCE((SELECT SUM(pv.stock) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true), 0),
    0.7::REAL
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE p.organization_id = org_id
    AND p.is_active = true
    AND (c.name ILIKE ANY(search_terms) OR c.slug ILIKE ANY(search_terms))
  ORDER BY p.name
  LIMIT result_limit;
END;
$$;
