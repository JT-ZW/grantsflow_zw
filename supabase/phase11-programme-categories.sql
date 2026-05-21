-- ============================================================
-- Phase 11: Programme Categories (sub-tracks within a programme)
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS programme_categories (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID        NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  description  TEXT,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE programme_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read programme categories"   ON programme_categories;
DROP POLICY IF EXISTS "Admin can manage programme categories" ON programme_categories;

CREATE POLICY "Staff can read programme categories" ON programme_categories
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'awardee'
  ));

CREATE POLICY "Admin can manage programme categories" ON programme_categories
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Add category FK to grants (nullable — grants without a category are fine)
ALTER TABLE grants ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES programme_categories(id) ON DELETE SET NULL;
