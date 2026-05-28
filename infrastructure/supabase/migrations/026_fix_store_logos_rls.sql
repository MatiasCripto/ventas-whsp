-- Fix store-logos RLS policies: use organization_id instead of auth.uid()
-- The previous policies checked (storage.foldername(name))[1] = auth.uid()::text
-- but the upload path uses organization_id as the first folder segment.
-- Now we verify that the user's profile belongs to the org in the path.

-- Drop old policies
DROP POLICY IF EXISTS "store_logos_insert" ON storage.objects;
DROP POLICY IF EXISTS "store_logos_update" ON storage.objects;
DROP POLICY IF EXISTS "store_logos_delete" ON storage.objects;
DROP POLICY IF EXISTS "store_logos_select" ON storage.objects;

-- Recreate with org-based permission check
CREATE POLICY "store_logos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-logos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id::text = (storage.foldername(name))[1]
    )
  );

-- Allow anyone to read public logos
CREATE POLICY "store_logos_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'store-logos');

-- Allow authenticated users to update their own org's logos
CREATE POLICY "store_logos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-logos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "store_logos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-logos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id::text = (storage.foldername(name))[1]
    )
  );
