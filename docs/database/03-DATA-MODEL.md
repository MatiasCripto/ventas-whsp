# Fase 3: Modelo de Datos y Migraciones

## Estrategia de Migraciones

Reutilizar el sistema de migraciones de Clinify (archivos SQL numerados en `infrastructure/supabase/migrations/`).

### Orden de Migraciones

```
001_core_schema.sql       ← Multi-tenant + auth (REUSADO de Clinify)
002_commerce_schema.sql   ← Productos, variantes, categorías (NUEVO)
003_customers.sql          ← Clientes + direcciones (ADAPTADO de patients)
004_orders.sql             ← Pedidos + items (ADAPTADO de appointments)
005_conversations.sql      ← Chats + mensajes (UNIFICADO de conversations + wa_conversations)
006_commerce_brain.sql     ← Search indexes + faq (NUEVO)
007_analytics.sql          ← KPIs + customer_scores (ADAPTADO)
008_automations.sql        ← Jobs + logs (REUSADO)
009_coupons.sql            ← Promociones (NUEVO)
010_shipping.sql           ← Envíos (NUEVO)
011_storage.sql            ← Buckets + RLS (ADAPTADO)
012_plans.sql              ← Planes + trials (REUSADO de Clinify)
```

### Detalle de Cada Migración

Ver archivos individuales en `infrastructure/supabase/migrations/` cuando se implemente.

## Diseño de Tablas Clave

### products
```sql
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  category_id     UUID REFERENCES categories(id),
  brand           TEXT,
  tags            TEXT[] DEFAULT '{}',
  price           NUMERIC(10,2) NOT NULL,
  compare_price   NUMERIC(10,2),  -- tachado (antes/después)
  images          TEXT[] DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  featured        BOOLEAN DEFAULT false,
  search_vector   TSVECTOR,  -- generado para full-text
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(organization_id) WHERE is_active = true;
CREATE INDEX idx_products_search ON products USING GIN(search_vector);
CREATE INDEX idx_products_tags ON products USING GIN(tags);
```

### product_variants
```sql
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
  UNIQUE(sku) -- NULLs allowed, solo cuando tiene SKU
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;
```

### orders
```sql
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
  store_id        UUID REFERENCES stores(id),
  customer_id     UUID REFERENCES customers(id) NOT NULL,
  status          order_status DEFAULT 'pending',
  
  -- Finanzas
  subtotal        NUMERIC(10,2) NOT NULL,
  shipping_cost   NUMERIC(10,2) DEFAULT 0,
  discount        NUMERIC(10,2) DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL,
  coupon_id       UUID REFERENCES coupons(id),
  
  -- Pago
  payment_method  TEXT, -- efectivo/transferencia/mercadopago/stripe
  payment_status  payment_status DEFAULT 'pending',
  payment_id      TEXT, -- ID externo de MP/Stripe
  
  -- Envío
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
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
```

### conversations
```sql
CREATE TYPE conversation_channel AS ENUM ('whatsapp', 'instagram', 'web');
CREATE TYPE conversation_status AS ENUM ('open', 'closed', 'bot', 'human');

CREATE TABLE conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) NOT NULL,
  store_id          UUID REFERENCES stores(id),
  customer_id       UUID REFERENCES customers(id),
  
  channel           conversation_channel DEFAULT 'whatsapp',
  channel_contact_id TEXT NOT NULL, -- wa number, ig id, etc
  channel_chat_id   TEXT NOT NULL,  -- wa chat id, ig thread, etc
  
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
```
