-- 015_storage_buckets.sql
-- Supabase Storage buckets for the concierge bot
-- Create buckets (idempotent) and set RLS policies

-- ── payment-proofs bucket ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
SELECT 'payment-proofs', 'payment-proofs', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'payment-proofs');

-- ── product-images bucket ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
SELECT 'product-images', 'product-images', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'product-images');

-- ── chat-media bucket ─────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
SELECT 'chat-media', 'chat-media', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-media');

-- ============================================================
-- RLS policies for payment-proofs bucket
-- ============================================================

-- Public read: anyone can view payment proof images
CREATE POLICY "payment_proofs_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs');

-- Authenticated insert: only authenticated users can upload
CREATE POLICY "payment_proofs_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND auth.role() = 'authenticated'
  );

-- Authenticated update: only authenticated users can update
CREATE POLICY "payment_proofs_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');

-- Authenticated delete: only authenticated users can delete
CREATE POLICY "payment_proofs_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');

-- ============================================================
-- RLS policies for product-images bucket
-- ============================================================

CREATE POLICY "product_images_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "product_images_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "product_images_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "product_images_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- ============================================================
-- RLS policies for chat-media bucket
-- ============================================================

CREATE POLICY "chat_media_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-media');

CREATE POLICY "chat_media_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-media'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "chat_media_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

CREATE POLICY "chat_media_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated');
