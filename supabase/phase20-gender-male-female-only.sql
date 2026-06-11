-- ── Phase 20: Gender Field — Restrict to Male / Female Only ─────────────────
-- Removes non_binary and prefer_not_to_say from the gender check constraint.
-- Run this in the Supabase SQL editor AFTER migrating any existing data.
-- Run this in the Supabase SQL editor.

-- Step 1: Nullify any existing values outside the new allowed set
-- (preserves existing female/male data)
UPDATE awardees
SET gender = NULL
WHERE gender NOT IN ('female', 'male');

-- Step 2: Drop the old check constraint
ALTER TABLE awardees
  DROP CONSTRAINT IF EXISTS awardees_gender_check;

-- Step 3: Add the new, tighter check constraint
ALTER TABLE awardees
  ADD CONSTRAINT awardees_gender_check
    CHECK (gender IN ('female', 'male'));

-- Step 4: Re-create the index (no-op if already exists)
CREATE INDEX IF NOT EXISTS awardees_gender_idx ON awardees (gender)
  WHERE gender IS NOT NULL;
