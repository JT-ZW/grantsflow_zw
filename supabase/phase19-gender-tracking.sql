-- ── Phase 19: Gender Tracking on Awardees ────────────────────────────────────
-- Adds gender field to awardees for impact reporting.
-- Run this in the Supabase SQL editor.

-- Block 1: Add gender column to awardees
ALTER TABLE awardees
  ADD COLUMN IF NOT EXISTS gender TEXT
    CHECK (gender IN ('female', 'male', 'non_binary', 'prefer_not_to_say'));

-- Block 2: Index for fast gender-based aggregation on impact reports
CREATE INDEX IF NOT EXISTS awardees_gender_idx ON awardees (gender)
  WHERE gender IS NOT NULL;

-- Block 3: Update default currency on grants table from ZAR to ZiG
ALTER TABLE grants
  ALTER COLUMN currency_code SET DEFAULT 'ZiG';

-- Block 4: Update default currency on disbursement_requests
ALTER TABLE disbursement_requests
  ALTER COLUMN currency_code SET DEFAULT 'ZiG';
