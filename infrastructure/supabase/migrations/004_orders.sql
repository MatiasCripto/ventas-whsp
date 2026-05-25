-- Orders schema

CREATE TYPE order_status AS ENUM (
  'pending', 'confirmed', 'paid', 'preparing',
  'shipped', 'delivered', 'cancelled'
);

CREATE TYPE payment_status AS ENUM (
  'pending', 'paid', 'failed', 'refunded'
);

-- ============================================================
-- Orders
-- ============================================================
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  store_id        UUID REFERENCES stores(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) NOT NULL,
  status          order_status DEFAULT 'pending',

  -- Finances
  subtotal        NUMERIC(10,2) NOT NULL,
  shipping_cost   NUMERIC(10,2) DEFAULT 0,
  discount        NUMERIC(10,2) DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL,
  coupon_id       UUID REFERENCES coupons(id) ON DELETE SET NULL,

  -- Payment
  payment_method  TEXT,  -- efectivo/transferencia/mercadopago/stripe
  payment_status  payment_status DEFAULT 'pending',
  payment_id      TEXT,  -- ID externo de MP/Stripe

  -- Shipping
  shipping_method TEXT,
  shipping_address TEXT,
  estimated_days  INTEGER,
  tracking_number TEXT,
  tracking_url    TEXT,

  -- Meta
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

-- ============================================================
-- Order Items
-- ============================================================
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

-- ============================================================
-- Carts (conversational commerce)
-- ============================================================
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

-- ============================================================
-- Cart Items
-- ============================================================
CREATE TABLE cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id     UUID REFERENCES carts(id) ON DELETE CASCADE,
  variant_id  UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1,
  added_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
