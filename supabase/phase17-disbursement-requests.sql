-- ============================================================
-- GrantFlow Phase 17: Disbursement Request Workflow
-- Run each block SEPARATELY in Supabase SQL Editor.
-- ============================================================

-- Block 1: Create disbursement_requests table
CREATE TABLE IF NOT EXISTS disbursement_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id        uuid NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  awardee_id      uuid NOT NULL REFERENCES awardees(id) ON DELETE CASCADE,
  amount          numeric(14, 2) NOT NULL CHECK (amount > 0),
  currency_code   text NOT NULL DEFAULT 'ZAR',
  milestone_id    uuid REFERENCES milestones(id) ON DELETE SET NULL,
  justification   text NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
  reviewed_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  review_notes    text,
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Block 2: Indexes
CREATE INDEX IF NOT EXISTS disbursement_requests_grant_idx    ON disbursement_requests (grant_id);
CREATE INDEX IF NOT EXISTS disbursement_requests_awardee_idx  ON disbursement_requests (awardee_id);
CREATE INDEX IF NOT EXISTS disbursement_requests_status_idx   ON disbursement_requests (status);

-- Block 3: Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_disbursement_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS disbursement_requests_updated_at ON disbursement_requests;
CREATE TRIGGER disbursement_requests_updated_at
  BEFORE UPDATE ON disbursement_requests
  FOR EACH ROW EXECUTE FUNCTION update_disbursement_requests_updated_at();

-- Block 4: Row Level Security
ALTER TABLE disbursement_requests ENABLE ROW LEVEL SECURITY;

-- Awardees can see and create their own requests
CREATE POLICY "awardees_select_own_disbursements" ON disbursement_requests
  FOR SELECT USING (
    awardee_id IN (
      SELECT id FROM awardees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "awardees_insert_own_disbursements" ON disbursement_requests
  FOR INSERT WITH CHECK (
    awardee_id IN (
      SELECT id FROM awardees WHERE user_id = auth.uid()
    )
  );

-- Admins and programme managers can see and update all requests
CREATE POLICY "admins_all_disbursements" ON disbursement_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'program_manager')
    )
  );
