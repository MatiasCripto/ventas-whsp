-- ============================================================
-- MIGRATION: 032_variant_attribute_values
-- Description: Add attribute_values JSONB column for dynamic
-- N-attribute variant support. attr1/attr2 were already handled
-- in 031.
-- ============================================================

-- 1. Add attribute_values JSONB column if not already present
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS attribute_values JSONB DEFAULT '{}'::jsonb;

-- 2. Make attribute_values NOT NULL for future rows
ALTER TABLE product_variants
  ALTER COLUMN attribute_values SET DEFAULT '{}'::jsonb,
  ALTER COLUMN attribute_values SET NOT NULL;

-- 3. Update search functions to return attribute_data JSONB instead of attr1_values/attr2_values
-- These replace the versions created in migration 031.

CREATE OR REPLACE FUNCTION search_products_by_text(query_text TEXT, org_id UUID)
RETURNS TABLE(
  product_id UUID, name TEXT, slug TEXT, price NUMERIC, compare_price NUMERIC,
  images TEXT[], category_name TEXT, attribute_data JSONB,
  stock BIGINT, score REAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.name, p.slug, p.price, p.compare_price, p.images,
    c.name,
    (
      SELECT jsonb_agg(DISTINCT pv.attribute_values)
      FROM product_variants pv
      WHERE pv.product_id = p.id AND pv.is_active = true
    ),
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
  images TEXT[], category_name TEXT, attribute_data JSONB,
  stock BIGINT, score REAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.name, p.slug, p.price, p.compare_price, p.images,
    c.name,
    (
      SELECT jsonb_agg(DISTINCT pv.attribute_values)
      FROM product_variants pv
      WHERE pv.product_id = p.id AND pv.is_active = true
    ),
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
  images TEXT[], category_name TEXT, attribute_data JSONB,
  stock BIGINT, score REAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.name, p.slug, p.price, p.compare_price, p.images,
    c.name,
    (
      SELECT jsonb_agg(DISTINCT pv.attribute_values)
      FROM product_variants pv
      WHERE pv.product_id = p.id AND pv.is_active = true
    ),
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
  images TEXT[], category_name TEXT, attribute_data JSONB,
  stock BIGINT, score REAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.name, p.slug, p.price, p.compare_price, p.images,
    c.name,
    (
      SELECT jsonb_agg(DISTINCT pv.attribute_values)
      FROM product_variants pv
      WHERE pv.product_id = p.id AND pv.is_active = true
    ),
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
