-- ============================================================
-- GrantFlow Phase 13: Awardee Project Self-Management
-- Run each block SEPARATELY in Supabase SQL Editor.
-- ============================================================

-- Block 1: Add narrative/project fields to grants
--   These fields are editable by the awardee via their portal;
--   admin-controlled fields (amount, dates, status) remain locked.
ALTER TABLE grants
  ADD COLUMN IF NOT EXISTS objectives          text,
  ADD COLUMN IF NOT EXISTS target_beneficiaries text,
  ADD COLUMN IF NOT EXISTS geographic_reach    text;

-- Block 2: Add milestone proposal fields
--   proposed_by      — profile id of the awardee who proposed it (NULL = admin-created)
--   proposal_status  — workflow state for awardee-proposed milestones
--   proposal_notes   — admin feedback (e.g. reason for rejection)
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS proposed_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proposal_status  text CHECK (
    proposal_status IN ('pending_approval', 'approved', 'rejected')
  ),
  ADD COLUMN IF NOT EXISTS proposal_notes   text;

-- Block 3: Index for efficient lookup of pending milestone proposals
CREATE INDEX IF NOT EXISTS milestones_proposal_status_idx
  ON milestones (proposal_status)
  WHERE proposal_status IS NOT NULL;

-- Block 4: RLS — awardees can read milestones they proposed
--   (they can already read milestones on their grants; this is a safety net
--    in case a future policy change restricts that)
--   No new RLS needed for writes — proposal inserts and grant narrative
--   updates are handled via the admin client with app-level ownership checks.

-- Block 5: Allow awardees to update their own awardee record (phone field only)
--   The server action enforces which fields are actually written.
DROP POLICY IF EXISTS "awardees: own update" ON awardees;
CREATE POLICY "awardees: own update" ON awardees
  FOR UPDATE
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
