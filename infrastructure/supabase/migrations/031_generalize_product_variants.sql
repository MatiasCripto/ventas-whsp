-- ============================================================
-- MIGRATION: 031_generalize_product_variants
-- Description: Rename color/size to attr1/attr2, add org settings
-- ============================================================

-- 1. Find and drop the existing UNIQUE constraint
-- The UNIQUE constraint on (product_id, color, size) was created by Postgres
-- with a generated name. We need to find it first.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'product_variants'::regclass
    AND contype = 'u'
    AND conkey::text = (
      SELECT array_agg(attnum ORDER BY attnum)::text
      FROM pg_attribute
      WHERE attrelid = 'product_variants'::regclass
        AND attname IN ('product_id', 'color', 'size')
    );

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE product_variants DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- 2. Rename columns
ALTER TABLE product_variants RENAME COLUMN color TO attr1;
ALTER TABLE product_variants RENAME COLUMN size TO attr2;

-- 3. Create new UNIQUE constraint
ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_product_id_attr1_attr2_key
  UNIQUE(product_id, attr1, attr2);

-- 4. Update indexes (drop old, create new)
DROP INDEX IF EXISTS idx_variants_sku;
CREATE INDEX idx_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;
-- The idx_variants_product index on product_id doesn't reference color/size, so it stays.

-- 5. Update search functions that reference pv.color and pv.size
-- Drop and recreate product_search functions

CREATE OR REPLACE FUNCTION search_products_by_text(query_text TEXT, org_id UUID)
RETURNS TABLE(
  product_id UUID, name TEXT, slug TEXT, price NUMERIC, compare_price NUMERIC,
  images TEXT[], category_name TEXT, attr1_values TEXT[], attr2_values TEXT[],
  stock BIGINT, score REAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.name, p.slug, p.price, p.compare_price, p.images,
    c.name,
    COALESCE((SELECT array_agg(DISTINCT pv.attr1) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true AND pv.attr1 IS NOT NULL), '{}'),
    COALESCE((SELECT array_agg(DISTINCT pv.attr2) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true AND pv.attr2 IS NOT NULL), '{}'),
    COALESCE((SELECT SUM(pv.stock) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true), 0),
    ts_rank(p.search_vector, plainto_tsquery('spanish', query_text))::REAL
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.organization_id = org_id
    AND p.search_vector @@ plainto_tsquery('spanish', query_text)
  ORDER BY score DESC
  LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION search_products_by_keywords(search_terms TEXT[], org_id UUID)
RETURNS TABLE(
  product_id UUID, name TEXT, slug TEXT, price NUMERIC, compare_price NUMERIC,
  images TEXT[], category_name TEXT, attr1_values TEXT[], attr2_values TEXT[],
  stock BIGINT, score REAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.name, p.slug, p.price, p.compare_price, p.images,
    c.name,
    COALESCE((SELECT array_agg(DISTINCT pv.attr1) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true AND pv.attr1 IS NOT NULL), '{}'),
    COALESCE((SELECT array_agg(DISTINCT pv.attr2) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true AND pv.attr2 IS NOT NULL), '{}'),
    COALESCE((SELECT SUM(pv.stock) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true), 0),
    similarity(p.name, unnest(search_terms))::REAL
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.organization_id = org_id
    AND (
      SELECT bool_or(p.name % term OR (p.description % term))
      FROM unnest(search_terms) AS term
    )
  ORDER BY score DESC
  LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION search_products_by_category(category_slug TEXT, org_id UUID)
RETURNS TABLE(
  product_id UUID, name TEXT, slug TEXT, price NUMERIC, compare_price NUMERIC,
  images TEXT[], category_name TEXT, attr1_values TEXT[], attr2_values TEXT[],
  stock BIGINT, score REAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.name, p.slug, p.price, p.compare_price, p.images,
    c.name,
    COALESCE((SELECT array_agg(DISTINCT pv.attr1) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true AND pv.attr1 IS NOT NULL), '{}'),
    COALESCE((SELECT array_agg(DISTINCT pv.attr2) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true AND pv.attr2 IS NOT NULL), '{}'),
    COALESCE((SELECT SUM(pv.stock) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true), 0),
    0.8::REAL
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.organization_id = org_id
    AND c.slug = category_slug
    AND p.is_active = true
  ORDER BY p.name
  LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION get_featured_products(org_id UUID)
RETURNS TABLE(
  product_id UUID, name TEXT, slug TEXT, price NUMERIC, compare_price NUMERIC,
  images TEXT[], category_name TEXT, attr1_values TEXT[], attr2_values TEXT[],
  stock BIGINT, score REAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.name, p.slug, p.price, p.compare_price, p.images,
    c.name,
    COALESCE((SELECT array_agg(DISTINCT pv.attr1) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true AND pv.attr1 IS NOT NULL), '{}'),
    COALESCE((SELECT array_agg(DISTINCT pv.attr2) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true AND pv.attr2 IS NOT NULL), '{}'),
    COALESCE((SELECT SUM(pv.stock) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true), 0),
    0.7::REAL
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.organization_id = org_id
    AND p.is_active = true
    AND p.featured = true
  ORDER BY p.name
  LIMIT 20;
END;
$$;
