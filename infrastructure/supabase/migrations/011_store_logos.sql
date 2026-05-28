-- Store logos: add logo_url column + storage bucket
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. Add logo_url to stores
-- ============================================================
ALTER TABLE stores ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ============================================================
-- 2. Create store-logos bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('store-logos', 'store-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload logos to their org's folder
CREATE POLICY "store_logos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow anyone to read public logos
CREATE POLICY "store_logos_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'store-logos');

-- Allow authenticated users to update/delete their own org's logos
CREATE POLICY "store_logos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "store_logos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
