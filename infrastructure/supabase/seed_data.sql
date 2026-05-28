-- Seed data for Concierge AI
-- User ID: 25099a56-a23d-48cf-8499-c95ddf6e9968 (johnny@gmail.com)

DO $$
DECLARE
  org_id UUID;
  store_id UUID;
  cat_remeras UUID;
  cat_pantalones UUID;
  cat_buzos UUID;
  cat_camperas UUID;
  cat_shorts UUID;
  cat_accesorios UUID;
  cat_calzado UUID;
  cat_ropa_interior UUID;
BEGIN

-- ============================================================
-- Organization
-- ============================================================
INSERT INTO organizations (id, name, slug, plan)
VALUES ('11111111-1111-1111-1111-111111111111', 'Mi Tienda', 'mi-tienda', 'growth')
RETURNING id INTO org_id;

-- ============================================================
-- Profile (linked to auth user)
-- ============================================================
INSERT INTO profiles (id, organization_id, full_name, role)
VALUES ('25099a56-a23d-48cf-8499-c95ddf6e9968', org_id, 'Johnny', 'owner');

-- ============================================================
-- Store
-- ============================================================
INSERT INTO stores (id, organization_id, name, phone, whatsapp_number, timezone)
VALUES ('22222222-2222-2222-2222-222222222222', org_id, 'Tienda Principal', '+5491123456789', '+5491123456789', 'America/Argentina/Buenos_Aires')
RETURNING id INTO store_id;

-- ============================================================
-- Categories
-- ============================================================
INSERT INTO categories (id, organization_id, name, slug, sort_order)
VALUES
  ('aaa11111-0000-0000-0000-000000000001', org_id, 'Remeras', 'remeras', 1),
  ('aaa11111-0000-0000-0000-000000000002', org_id, 'Pantalones', 'pantalones', 2),
  ('aaa11111-0000-0000-0000-000000000003', org_id, 'Buzos', 'buzos', 3),
  ('aaa11111-0000-0000-0000-000000000004', org_id, 'Camperas', 'camperas', 4),
  ('aaa11111-0000-0000-0000-000000000005', org_id, 'Shorts', 'shorts', 5),
  ('aaa11111-0000-0000-0000-000000000006', org_id, 'Accesorios', 'accesorios', 6),
  ('aaa11111-0000-0000-0000-000000000007', org_id, 'Calzado', 'calzado', 7),
  ('aaa11111-0000-0000-0000-000000000008', org_id, 'Ropa Interior', 'ropa-interior', 8)
RETURNING id INTO cat_remeras;
-- Get all category IDs
SELECT id INTO cat_remeras FROM categories WHERE slug = 'remeras' AND organization_id = org_id;
SELECT id INTO cat_pantalones FROM categories WHERE slug = 'pantalones' AND organization_id = org_id;
SELECT id INTO cat_buzos FROM categories WHERE slug = 'buzos' AND organization_id = org_id;
SELECT id INTO cat_camperas FROM categories WHERE slug = 'camperas' AND organization_id = org_id;
SELECT id INTO cat_shorts FROM categories WHERE slug = 'shorts' AND organization_id = org_id;
SELECT id INTO cat_accesorios FROM categories WHERE slug = 'accesorios' AND organization_id = org_id;
SELECT id INTO cat_calzado FROM categories WHERE slug = 'calzado' AND organization_id = org_id;
SELECT id INTO cat_ropa_interior FROM categories WHERE slug = 'ropa-interior' AND organization_id = org_id;

-- ============================================================
-- Products with variants
-- ============================================================

-- 1. Remera Básica Algodón
INSERT INTO products (id, organization_id, name, slug, price, compare_price, category_id, tags, is_active, featured)
VALUES ('bbb11111-0000-0000-0000-000000000001', org_id, 'Remera Básica Algodón', 'remera-basica-algodon', 4500, 5500, cat_remeras, ARRAY['basica','algodon','casual'], true, false);
INSERT INTO product_variants (product_id, color, size, stock) VALUES
  ('bbb11111-0000-0000-0000-000000000001', 'Blanco', 'S', 15),
  ('bbb11111-0000-0000-0000-000000000001', 'Blanco', 'M', 20),
  ('bbb11111-0000-0000-0000-000000000001', 'Blanco', 'L', 18),
  ('bbb11111-0000-0000-0000-000000000001', 'Blanco', 'XL', 10),
  ('bbb11111-0000-0000-0000-000000000001', 'Negro', 'S', 12),
  ('bbb11111-0000-0000-0000-000000000001', 'Negro', 'M', 22),
  ('bbb11111-0000-0000-0000-000000000001', 'Negro', 'L', 16),
  ('bbb11111-0000-0000-0000-000000000001', 'Negro', 'XL', 8),
  ('bbb11111-0000-0000-0000-000000000001', 'Gris', 'M', 14),
  ('bbb11111-0000-0000-0000-000000000001', 'Gris', 'L', 12);

-- 2. Remera Oversize
INSERT INTO products (id, organization_id, name, slug, price, category_id, tags, is_active)
VALUES ('bbb11111-0000-0000-0000-000000000002', org_id, 'Remera Oversize', 'remera-oversize', 5800, cat_remeras, ARRAY['oversize','moda','holgada'], true);
INSERT INTO product_variants (product_id, color, size, stock) VALUES
  ('bbb11111-0000-0000-0000-000000000002', 'Blanco', 'M', 10), ('bbb11111-0000-0000-0000-000000000002', 'Blanco', 'L', 15),
  ('bbb11111-0000-0000-0000-000000000002', 'Negro', 'M', 12), ('bbb11111-0000-0000-0000-000000000002', 'Negro', 'L', 14),
  ('bbb11111-0000-0000-0000-000000000002', 'Beige', 'M', 8), ('bbb11111-0000-0000-0000-000000000002', 'Beige', 'L', 10),
  ('bbb11111-0000-0000-0000-000000000002', 'Verde Militar', 'M', 6), ('bbb11111-0000-0000-0000-000000000002', 'Verde Militar', 'L', 8);

-- 3. Jean Clásico
INSERT INTO products (id, organization_id, name, slug, price, compare_price, category_id, tags, is_active)
VALUES ('bbb11111-0000-0000-0000-000000000003', org_id, 'Jean Clásico', 'jean-clasico', 12000, 15000, cat_pantalones, ARRAY['jean','denim','clasico'], true);
INSERT INTO product_variants (product_id, color, size, stock) VALUES
  ('bbb11111-0000-0000-0000-000000000003', 'Azul Claro', '38', 5), ('bbb11111-0000-0000-0000-000000000003', 'Azul Claro', '40', 8),
  ('bbb11111-0000-0000-0000-000000000003', 'Azul Oscuro', '38', 6), ('bbb11111-0000-0000-0000-000000000003', 'Azul Oscuro', '40', 7),
  ('bbb11111-0000-0000-0000-000000000003', 'Azul Oscuro', '42', 4), ('bbb11111-0000-0000-0000-000000000003', 'Negro', '40', 5);

-- 4. Jogging Deportivo
INSERT INTO products (id, organization_id, name, slug, price, category_id, tags, is_active)
VALUES ('bbb11111-0000-0000-0000-000000000004', org_id, 'Jogging Deportivo', 'jogging-deportivo', 8500, cat_pantalones, ARRAY['jogging','deportivo','algodon'], true);
INSERT INTO product_variants (product_id, color, size, stock) VALUES
  ('bbb11111-0000-0000-0000-000000000004', 'Negro', 'S', 10), ('bbb11111-0000-0000-0000-000000000004', 'Negro', 'M', 15),
  ('bbb11111-0000-0000-0000-000000000004', 'Negro', 'L', 12), ('bbb11111-0000-0000-0000-000000000004', 'Gris', 'M', 10),
  ('bbb11111-0000-0000-0000-000000000004', 'Gris', 'L', 8), ('bbb11111-0000-0000-0000-000000000004', 'Azul Marino', 'M', 6);

-- 5. Buzo Canguro
INSERT INTO products (id, organization_id, name, slug, price, compare_price, category_id, tags, is_active)
VALUES ('bbb11111-0000-0000-0000-000000000005', org_id, 'Buzo Canguro', 'buzo-canguro', 9500, 11000, cat_buzos, ARRAY['buzo','canguro','abrigo'], true);
INSERT INTO product_variants (product_id, color, size, stock) VALUES
  ('bbb11111-0000-0000-0000-000000000005', 'Negro', 'M', 8), ('bbb11111-0000-0000-0000-000000000005', 'Negro', 'L', 10),
  ('bbb11111-0000-0000-0000-000000000005', 'Negro', 'XL', 6), ('bbb11111-0000-0000-0000-000000000005', 'Gris', 'M', 7),
  ('bbb11111-0000-0000-0000-000000000005', 'Gris', 'L', 9), ('bbb11111-0000-0000-0000-000000000005', 'Borgoña', 'M', 5);

-- 6. Campera Rompevientos
INSERT INTO products (id, organization_id, name, slug, price, compare_price, category_id, tags, is_active)
VALUES ('bbb11111-0000-0000-0000-000000000006', org_id, 'Campera Rompevientos', 'campera-rompevientos', 15000, 18500, cat_camperas, ARRAY['campera','rompevientos','abrigo'], true);
INSERT INTO product_variants (product_id, color, size, stock) VALUES
  ('bbb11111-0000-0000-0000-000000000006', 'Negro', 'M', 5), ('bbb11111-0000-0000-0000-000000000006', 'Negro', 'L', 8),
  ('bbb11111-0000-0000-0000-000000000006', 'Negro', 'XL', 4), ('bbb11111-0000-0000-0000-000000000006', 'Verde', 'M', 3);

-- 7. Short Deportivo
INSERT INTO products (id, organization_id, name, slug, price, category_id, tags, is_active)
VALUES ('bbb11111-0000-0000-0000-000000000007', org_id, 'Short Deportivo', 'short-deportivo', 5500, cat_shorts, ARRAY['short','deportivo','verano'], true);
INSERT INTO product_variants (product_id, color, size, stock) VALUES
  ('bbb11111-0000-0000-0000-000000000007', 'Negro', 'S', 8), ('bbb11111-0000-0000-0000-000000000007', 'Negro', 'M', 12),
  ('bbb11111-0000-0000-0000-000000000007', 'Negro', 'L', 10), ('bbb11111-0000-0000-0000-000000000007', 'Gris', 'M', 8);

-- 8. Boxer Algodón x2
INSERT INTO products (id, organization_id, name, slug, price, compare_price, category_id, tags, is_active)
VALUES ('bbb11111-0000-0000-0000-000000000008', org_id, 'Boxer Algodón x2', 'boxer-algodon-x2', 3500, 4500, cat_ropa_interior, ARRAY['boxer','interior','algodon'], true);
INSERT INTO product_variants (product_id, color, size, stock) VALUES
  ('bbb11111-0000-0000-0000-000000000008', 'Negro', 'M', 20), ('bbb11111-0000-0000-0000-000000000008', 'Negro', 'L', 18),
  ('bbb11111-0000-0000-0000-000000000008', 'Blanco', 'M', 15), ('bbb11111-0000-0000-0000-000000000008', 'Blanco', 'L', 12);

-- 9. Gorra Visera Plana
INSERT INTO products (id, organization_id, name, slug, price, category_id, tags, is_active)
VALUES ('bbb11111-0000-0000-0000-000000000009', org_id, 'Gorra Visera Plana', 'gorra-visera-plana', 3800, cat_accesorios, ARRAY['gorra','accesorio','urbano'], true);
INSERT INTO product_variants (product_id, color, size, stock) VALUES
  ('bbb11111-0000-0000-0000-000000000009', 'Negro', 'Unico', 15),
  ('bbb11111-0000-0000-0000-000000000009', 'Rojo', 'Unico', 10),
  ('bbb11111-0000-0000-0000-000000000009', 'Azul', 'Unico', 12),
  ('bbb11111-0000-0000-0000-000000000009', 'Blanco', 'Unico', 8);

-- 10. Mochila Urbana
INSERT INTO products (id, organization_id, name, slug, price, category_id, tags, is_active)
VALUES ('bbb11111-0000-0000-0000-000000000010', org_id, 'Mochila Urbana', 'mochila-urbana', 8500, cat_accesorios, ARRAY['mochila','urbana','accesorio'], true);
INSERT INTO product_variants (product_id, color, size, stock) VALUES
  ('bbb11111-0000-0000-0000-000000000010', 'Negro', 'Unico', 8),
  ('bbb11111-0000-0000-0000-000000000010', 'Gris', 'Unico', 6);

-- 11. Zapatillas Urbanas
INSERT INTO products (id, organization_id, name, slug, price, compare_price, category_id, tags, is_active)
VALUES ('bbb11111-0000-0000-0000-000000000011', org_id, 'Zapatillas Urbanas', 'zapatillas-urbanas', 22000, 28000, cat_calzado, ARRAY['zapatillas','urbano','moda'], true);
INSERT INTO product_variants (product_id, color, size, stock) VALUES
  ('bbb11111-0000-0000-0000-000000000011', 'Blanco', '40', 4), ('bbb11111-0000-0000-0000-000000000011', 'Blanco', '41', 6),
  ('bbb11111-0000-0000-0000-000000000011', 'Blanco', '42', 5), ('bbb11111-0000-0000-0000-000000000011', 'Negro', '40', 3),
  ('bbb11111-0000-0000-0000-000000000011', 'Negro', '41', 5), ('bbb11111-0000-0000-0000-000000000011', 'Negro', '42', 4);

-- 12. Medias Algodón x3
INSERT INTO products (id, organization_id, name, slug, price, category_id, tags, is_active)
VALUES ('bbb11111-0000-0000-0000-000000000012', org_id, 'Medias Algodón x3', 'medias-algodon-x3', 2500, cat_accesorios, ARRAY['medias','algodon','basico'], true);
INSERT INTO product_variants (product_id, color, size, stock) VALUES
  ('bbb11111-0000-0000-0000-000000000012', 'Negro', 'Unico', 30),
  ('bbb11111-0000-0000-0000-000000000012', 'Blanco', 'Unico', 25),
  ('bbb11111-0000-0000-0000-000000000012', 'Mixto', 'Unico', 20);

-- Trigger search vector update for all products
UPDATE products SET name = name WHERE organization_id = org_id;

-- Update store_id on customers/policies
UPDATE stores SET name = 'Tienda Principal' WHERE id = store_id;

RAISE NOTICE 'Seed data inserted successfully!';
END $$;
