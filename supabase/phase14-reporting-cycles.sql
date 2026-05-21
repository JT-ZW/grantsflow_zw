-- ============================================================
-- GrantFlow Phase 14: Formal Reporting Cycles
-- Run each block SEPARATELY in Supabase SQL Editor.
-- ============================================================

-- Block 1: Create grant_reports table
--   period_label   — human-readable label e.g. "Q1 2026", "Annual 2025", "Final"
--   report_type    — category for filtering
--   status         — workflow: draft → submitted → under_review → approved
--                                                             ↘ revision_requested → draft (loop)
--   content        — narrative body (rich text stored as plain text)
--   submitted_at   — timestamp when awardee clicked "Submit"
--   reviewed_by    — profile id of the admin who reviewed
--   reviewed_at    — timestamp of review action
--   review_notes   — admin feedback (always shown to awardee)
CREATE TABLE IF NOT EXISTS grant_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id      uuid NOT NULL REFERENCES grants(id)    ON DELETE CASCADE,
  awardee_id    uuid NOT NULL REFERENCES awardees(id)  ON DELETE CASCADE,
  period_label  text NOT NULL,
  report_type   text NOT NULL CHECK (
    report_type IN ('quarterly', 'annual', 'final', 'ad_hoc')
  ),
  status        text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'submitted', 'under_review', 'approved', 'revision_requested')
  ),
  content       text,
  submitted_at  timestamptz,
  reviewed_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  review_notes  text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Block 2: Indexes for common query patterns
CREATE INDEX IF NOT EXISTS grant_reports_grant_id_idx    ON grant_reports (grant_id);
CREATE INDEX IF NOT EXISTS grant_reports_awardee_id_idx  ON grant_reports (awardee_id);
CREATE INDEX IF NOT EXISTS grant_reports_status_idx      ON grant_reports (status)
  WHERE status IN ('submitted', 'under_review');

-- Block 3: Keep updated_at current on every row change
CREATE OR REPLACE FUNCTION set_grant_reports_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grant_reports_updated_at ON grant_reports;
CREATE TRIGGER grant_reports_updated_at
  BEFORE UPDATE ON grant_reports
  FOR EACH ROW EXECUTE FUNCTION set_grant_reports_updated_at();

-- Block 4: Row Level Security
ALTER TABLE grant_reports ENABLE ROW LEVEL SECURITY;

-- Awardees can read their own reports
DROP POLICY IF EXISTS "awardees: read own reports" ON grant_reports;
CREATE POLICY "awardees: read own reports" ON grant_reports
  FOR SELECT
  USING (
    awardee_id IN (
      SELECT id FROM awardees WHERE user_id = auth.uid()
    )
  );

-- Awardees can create new (draft) reports for their own grant
DROP POLICY IF EXISTS "awardees: insert own reports" ON grant_reports;
CREATE POLICY "awardees: insert own reports" ON grant_reports
  FOR INSERT
  WITH CHECK (
    awardee_id IN (
      SELECT id FROM awardees WHERE user_id = auth.uid()
    )
  );

-- Awardees can edit reports that are still in draft or revision_requested state
DROP POLICY IF EXISTS "awardees: update own draft reports" ON grant_reports;
CREATE POLICY "awardees: update own draft reports" ON grant_reports
  FOR UPDATE
  USING (
    awardee_id IN (
      SELECT id FROM awardees WHERE user_id = auth.uid()
    )
    AND status IN ('draft', 'revision_requested')
  )
  WITH CHECK (
    awardee_id IN (
      SELECT id FROM awardees WHERE user_id = auth.uid()
    )
  );

-- Staff (admin, program_manager, finance_officer, auditor) can read all reports
DROP POLICY IF EXISTS "staff: read all reports" ON grant_reports;
CREATE POLICY "staff: read all reports" ON grant_reports
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role IN ('admin', 'program_manager', 'finance_officer', 'auditor')
    )
  );

-- Admin and program_manager can update status/review fields
DROP POLICY IF EXISTS "staff: review reports" ON grant_reports;
CREATE POLICY "staff: review reports" ON grant_reports
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role IN ('admin', 'program_manager')
    )
  );
