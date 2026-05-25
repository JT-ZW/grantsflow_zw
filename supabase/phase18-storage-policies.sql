-- ── Phase 18: Storage bucket policies ────────────────────────────────────────
-- Adds RLS policies for both private storage buckets.
-- Run this in the Supabase SQL editor.

-- ═══════════════════════════════════════════════════════════════════════
-- Bucket: expense-receipts
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload receipts"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'expense-receipts');

DROP POLICY IF EXISTS "Users can read their own receipts" ON storage.objects;
CREATE POLICY "Users can read their own receipts"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND owner = auth.uid()
  );

DROP POLICY IF EXISTS "Staff can read all receipts" ON storage.objects;
CREATE POLICY "Staff can read all receipts"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'program_manager', 'finance_officer', 'auditor')
    )
  );

DROP POLICY IF EXISTS "Users can delete their own receipts" ON storage.objects;
CREATE POLICY "Users can delete their own receipts"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND owner = auth.uid()
  );

-- ═══════════════════════════════════════════════════════════════════════
-- Bucket: grant-documents
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can upload grant documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload grant documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'grants-documents');

DROP POLICY IF EXISTS "Users can read their own grant documents" ON storage.objects;
CREATE POLICY "Users can read their own grant documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'grants-documents'
    AND owner = auth.uid()
  );

DROP POLICY IF EXISTS "Staff can read all grant documents" ON storage.objects;
CREATE POLICY "Staff can read all grant documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'grants-documents'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'program_manager', 'finance_officer', 'auditor')
    )
  );

DROP POLICY IF EXISTS "Staff can delete grant documents" ON storage.objects;
CREATE POLICY "Staff can delete grant documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'grants-documents'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'program_manager')
    )
  );

DROP POLICY IF EXISTS "Users can delete their own grant documents" ON storage.objects;
CREATE POLICY "Users can delete their own grant documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'grants-documents'
    AND owner = auth.uid()
  );
