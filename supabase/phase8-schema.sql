-- ============================================================
-- Phase 8: Approval Workflow, Receipts, Programmes,
--          Messages, Doc Versioning, Risk, Auto-delay
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. Grant Approval Workflow ────────────────────────────────────────────────
ALTER TABLE grants
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('draft','submitted','under_review','approved','rejected'));

-- Migrate existing data sensibly
UPDATE grants SET approval_status = 'approved'   WHERE status IN ('active','completed') AND approval_status = 'approved';
UPDATE grants SET approval_status = 'submitted'  WHERE status = 'suspended' AND approval_status = 'approved';

-- Optional: add a notes field for rejection reason
ALTER TABLE grants ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- ── 2. Expense Receipt File Uploads ──────────────────────────────────────────
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_storage_path TEXT;

-- Create expense-receipts bucket (run once; skip if already exists)
-- You must also create this bucket in Supabase Storage dashboard:
-- Name: expense-receipts, Public: false

-- ── 3. Programmes / Cohorts ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS programmes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  description   TEXT,
  total_budget  NUMERIC(14,2),
  currency_code TEXT        DEFAULT 'USD',
  start_date    DATE,
  end_date      DATE,
  created_by    UUID        REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read programmes"   ON programmes;
DROP POLICY IF EXISTS "Admin can manage programmes" ON programmes;

CREATE POLICY "Staff can read programmes" ON programmes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'awardee'
  ));

CREATE POLICY "Admin can manage programmes" ON programmes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

ALTER TABLE grants ADD COLUMN IF NOT EXISTS programme_id UUID REFERENCES programmes(id) ON DELETE SET NULL;

-- ── 4. Grant Communication Thread (Messages) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id            UUID        NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  sender_id           UUID        NOT NULL REFERENCES profiles(id),
  body                TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  read_by_admin_at    TIMESTAMPTZ,
  read_by_awardee_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read all messages"           ON messages;
DROP POLICY IF EXISTS "Awardees can read their messages"      ON messages;
DROP POLICY IF EXISTS "Users can send messages"               ON messages;
DROP POLICY IF EXISTS "Staff can mark messages read"          ON messages;

-- Staff see all messages
CREATE POLICY "Staff can read all messages" ON messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('admin','program_manager','finance_officer','auditor')
  ));

-- Awardees only see messages on their own grant
CREATE POLICY "Awardees can read their messages" ON messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM grants g
    JOIN awardees aw ON g.awardee_id = aw.id
    WHERE g.id = messages.grant_id AND aw.user_id = auth.uid()
  ));

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Staff can mark messages read" ON messages
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('admin','program_manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('admin','program_manager')
  ));

CREATE POLICY "Awardees can mark their messages read" ON messages
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM grants g
    JOIN awardees aw ON g.awardee_id = aw.id
    WHERE g.id = messages.grant_id AND aw.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM grants g
    JOIN awardees aw ON g.awardee_id = aw.id
    WHERE g.id = messages.grant_id AND aw.user_id = auth.uid()
  ));

-- ── 5. Document Versioning ────────────────────────────────────────────────────
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version              INTEGER NOT NULL DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_current           BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS previous_version_id  UUID REFERENCES documents(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS category             TEXT;

-- ── 6. Milestone Auto-Delay Function ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION flag_overdue_milestones()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE milestones
  SET    status = 'delayed'
  WHERE  due_date < CURRENT_DATE
    AND  status NOT IN ('completed', 'delayed', 'cancelled');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Optional: grant execute to authenticated so the app can call it
GRANT EXECUTE ON FUNCTION flag_overdue_milestones() TO authenticated;

-- ── Done ──────────────────────────────────────────────────────────────────────
-- Also create these storage buckets in the Supabase dashboard:
--   1. expense-receipts  (private, 10 MB max)
-- The grant-documents bucket should already exist from phase7.
