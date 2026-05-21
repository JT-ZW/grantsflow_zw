-- ============================================================
-- GrantFlow Phase 15: Budget Amendment Requests
-- Run each block SEPARATELY in Supabase SQL Editor.
-- ============================================================

-- Block 1: Create budget_amendments table
--   request_type  — what the awardee is asking to change:
--     'new_line'      : add a brand-new budget category
--     'reallocation'  : move funds from one category to another
--     'increase'      : request additional funds for an existing category
--   category      — the target category for the change
--   amount        — amount to add/move/allocate
--   from_category — source category (only for 'reallocation')
--   justification — awardee's explanation of why the change is needed
--   status        — pending → approved | rejected
--   When approved, admin uses the existing budget line form to apply the change.
CREATE TABLE IF NOT EXISTS budget_amendments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id      uuid NOT NULL REFERENCES grants(id)    ON DELETE CASCADE,
  awardee_id    uuid NOT NULL REFERENCES awardees(id)  ON DELETE CASCADE,
  request_type  text NOT NULL CHECK (
    request_type IN ('new_line', 'reallocation', 'increase')
  ),
  status        text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected')
  ),
  category      text NOT NULL,
  amount        numeric NOT NULL CHECK (amount > 0),
  currency_code text NOT NULL DEFAULT 'ZAR',
  from_category text,                       -- reallocation source
  justification text NOT NULL,
  reviewed_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  review_notes  text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Block 2: Indexes
CREATE INDEX IF NOT EXISTS budget_amendments_grant_id_idx    ON budget_amendments (grant_id);
CREATE INDEX IF NOT EXISTS budget_amendments_awardee_id_idx  ON budget_amendments (awardee_id);
CREATE INDEX IF NOT EXISTS budget_amendments_status_idx      ON budget_amendments (status)
  WHERE status = 'pending';

-- Block 3: updated_at trigger
CREATE OR REPLACE FUNCTION set_budget_amendments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS budget_amendments_updated_at ON budget_amendments;
CREATE TRIGGER budget_amendments_updated_at
  BEFORE UPDATE ON budget_amendments
  FOR EACH ROW EXECUTE FUNCTION set_budget_amendments_updated_at();

-- Block 4: Row Level Security
ALTER TABLE budget_amendments ENABLE ROW LEVEL SECURITY;

-- Awardees can read their own amendment requests
DROP POLICY IF EXISTS "awardees: read own amendments" ON budget_amendments;
CREATE POLICY "awardees: read own amendments" ON budget_amendments
  FOR SELECT
  USING (
    awardee_id IN (
      SELECT id FROM awardees WHERE user_id = auth.uid()
    )
  );

-- Awardees can submit new amendment requests
DROP POLICY IF EXISTS "awardees: insert own amendments" ON budget_amendments;
CREATE POLICY "awardees: insert own amendments" ON budget_amendments
  FOR INSERT
  WITH CHECK (
    awardee_id IN (
      SELECT id FROM awardees WHERE user_id = auth.uid()
    )
  );

-- Staff can read all amendment requests
DROP POLICY IF EXISTS "staff: read all amendments" ON budget_amendments;
CREATE POLICY "staff: read all amendments" ON budget_amendments
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role IN ('admin', 'program_manager', 'finance_officer', 'auditor')
    )
  );

-- Admin and program_manager can review (approve/reject) amendments
DROP POLICY IF EXISTS "staff: review amendments" ON budget_amendments;
CREATE POLICY "staff: review amendments" ON budget_amendments
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role IN ('admin', 'program_manager')
    )
  );
