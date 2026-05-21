-- ============================================================
-- GrantFlow Phase 9: Enhanced milestone tracking
-- Run each block separately in Supabase SQL Editor
-- (copy one block at a time and click Run between each).
-- Running all at once can cause a deadlock.
-- ============================================================

-- Block 1 of 6
alter table milestone_updates
  add column if not exists completion_pct integer check (completion_pct between 0 and 100);

-- Block 2 of 6
alter table milestone_updates
  add column if not exists planned_next text;

-- Block 3 of 6
alter table milestone_updates
  add column if not exists blockers text;

-- Block 4 of 6
alter table milestones
  add column if not exists completion_pct integer check (completion_pct between 0 and 100);

-- Block 5 of 6
alter table milestones
  add column if not exists admin_notes text;

-- Block 6 of 6
alter table milestones
  add column if not exists admin_flag text check (admin_flag in ('on_track', 'needs_attention', 'at_risk'));

-- No new RLS policies needed:
--   milestone_updates: awardees can already insert/read their own rows; staff can read all
--   milestones: "milestones: admin/pm write" (FOR ALL) already covers admin_notes/admin_flag updates
