-- Commerce schema: products, variants, categories

-- ============================================================
-- Categories
-- ============================================================
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

-- ============================================================
-- Products
-- ============================================================
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
  compare_price   NUMERIC(10,2),  -- tachado (antes/después)
  images          TEXT[] DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  featured        BOOLEAN DEFAULT false,
  search_vector   TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('spanish', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(array_to_string(tags, ' '),''))
  ) STORED,
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

-- ============================================================
-- Product Variants (color, size, stock)
-- ============================================================
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
  UNIQUE(sku)   -- NULLs allowed, only when SKU is provided
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;

-- ============================================================
-- Product Images
-- ============================================================
CREATE TABLE product_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id  UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  url         TEXT NOT NULL,
  alt         TEXT,
  sort_order  INTEGER DEFAULT 0
);

CREATE INDEX idx_product_images_product ON product_images(product_id);

-- ============================================================
-- Inventory Movements (audit trail)
-- ============================================================
CREATE TYPE inventory_movement_type AS ENUM ('in', 'out', 'adjustment');

CREATE TABLE inventory_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id      UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity        INTEGER NOT NULL,
  type            inventory_movement_type NOT NULL,
  reference_type  TEXT,  -- 'order', 'manual', 'return'
  reference_id    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inventory_variant ON inventory_movements(variant_id);
CREATE INDEX idx_inventory_ref ON inventory_movements(reference_type, reference_id);

-- ============================================================
-- Search functions (for Commerce Brain)
-- ============================================================

-- Full-text search
CREATE OR REPLACE FUNCTION search_products_fts(
  query_text TEXT,
  org_id UUID,
  result_limit INTEGER DEFAULT 5
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

-- Trigram similarity search (typo-tolerant)
CREATE OR REPLACE FUNCTION search_products_trigram(
  search_terms TEXT[],
  org_id UUID,
  result_limit INTEGER DEFAULT 5
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

-- Tag-based search
CREATE OR REPLACE FUNCTION search_products_by_tags(
  search_terms TEXT[],
  org_id UUID,
  result_limit INTEGER DEFAULT 5
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

-- Category-based search
CREATE OR REPLACE FUNCTION search_products_by_category(
  search_terms TEXT[],
  org_id UUID,
  result_limit INTEGER DEFAULT 5
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
