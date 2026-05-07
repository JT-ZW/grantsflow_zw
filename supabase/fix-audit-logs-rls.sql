-- ============================================================
-- GrantsFlow: Fix audit_logs RLS policies
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Allow any authenticated user to insert their own audit log entries
--    (server actions call this with the signed-in user's session)
create policy "audit_logs: authenticated insert" on audit_logs
  for insert with check (actor_id = auth.uid());

-- 2. Expand read access to all staff roles (was only admin + auditor)
drop policy if exists "audit_logs: staff read" on audit_logs;

create policy "audit_logs: staff read" on audit_logs
  for select using (
    current_user_role() in ('admin', 'program_manager', 'finance_officer', 'auditor')
  );
