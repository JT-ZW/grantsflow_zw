-- ============================================================
-- GrantFlow Phase 12: Unified invite flow & team members
-- Run each block SEPARATELY in Supabase SQL Editor.
-- ============================================================

-- Block 1: awardee_members junction table
-- Links multiple portal users (profiles) to a single awardee record.
create table if not exists awardee_members (
  id         uuid primary key default gen_random_uuid(),
  awardee_id uuid not null references awardees(id) on delete cascade,
  profile_id uuid not null references profiles(id)  on delete cascade,
  is_primary boolean not null default false,
  invited_at timestamptz not null default now(),
  unique (awardee_id, profile_id)
);

alter table awardee_members enable row level security;

-- Members can see their own rows
create policy "awardee_members: own rows" on awardee_members
  for select using (profile_id = auth.uid());

-- Staff can see all
create policy "awardee_members: staff read" on awardee_members
  for select using (
    current_user_role() in ('admin', 'program_manager', 'finance_officer', 'auditor')
  );

-- Only admins can write (inserts happen via server action with admin client)
create policy "awardee_members: admin write" on awardee_members
  for all using (current_user_role() = 'admin');

-- Block 2: Helper — returns every awardee_id the current user can access
-- (either as primary contact or as a team member)
create or replace function my_awardee_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id        from awardees        where user_id  = auth.uid()
  union
  select awardee_id from awardee_members where profile_id = auth.uid()
$$;

-- Block 3: Update grants RLS — replace hard user_id check with my_awardee_ids()
drop policy if exists "grants: awardee read own" on grants;
create policy "grants: awardee read own" on grants
  for select using (
    awardee_id in (select my_awardee_ids())
  );

-- Block 4: Update milestones RLS
drop policy if exists "milestones: awardee read own" on milestones;
create policy "milestones: awardee read own" on milestones
  for select using (
    grant_id in (
      select g.id from grants g
      where g.awardee_id in (select my_awardee_ids())
    )
  );

-- Block 5: Update awardees RLS — own record
drop policy if exists "awardees: own record" on awardees;
create policy "awardees: own record" on awardees
  for select using (
    id in (select my_awardee_ids())
  );

-- Block 6: Update budgets RLS
drop policy if exists "budgets: awardee read own" on budgets;
create policy "budgets: awardee read own" on budgets
  for select using (
    grant_id in (
      select g.id from grants g
      where g.awardee_id in (select my_awardee_ids())
    )
  );

-- Block 7: Update disbursements RLS
drop policy if exists "disbursements: awardee read own" on disbursements;
create policy "disbursements: awardee read own" on disbursements
  for select using (
    grant_id in (
      select g.id from grants g
      where g.awardee_id in (select my_awardee_ids())
    )
  );

-- Block 8: Update milestone_updates RLS
drop policy if exists "milestone_updates: awardee insert" on milestone_updates;
create policy "milestone_updates: awardee insert" on milestone_updates
  for insert with check (
    submitted_by = auth.uid()
    and milestone_id in (
      select m.id from milestones m
      join grants g on m.grant_id = g.id
      where g.awardee_id in (select my_awardee_ids())
    )
  );

drop policy if exists "milestone_updates: awardee read" on milestone_updates;
create policy "milestone_updates: awardee read" on milestone_updates
  for select using (
    milestone_id in (
      select m.id from milestones m
      join grants g on m.grant_id = g.id
      where g.awardee_id in (select my_awardee_ids())
    )
  );

-- Block 9: Update documents RLS
drop policy if exists "documents: awardee read own" on documents;
create policy "documents: awardee read own" on documents
  for select using (
    grant_id in (
      select g.id from grants g
      where g.awardee_id in (select my_awardee_ids())
    )
  );

drop policy if exists "documents: awardee insert own" on documents;
create policy "documents: awardee insert own" on documents
  for insert with check (
    uploaded_by = auth.uid()
    and grant_id in (
      select g.id from grants g
      where g.awardee_id in (select my_awardee_ids())
    )
  );

-- Block 10: Update messages RLS
drop policy if exists "Awardees can read their messages" on messages;
create policy "Awardees can read their messages" on messages
  for select to authenticated
  using (
    grant_id in (
      select g.id from grants g
      where g.awardee_id in (select my_awardee_ids())
    )
  );

drop policy if exists "Awardees can mark their messages read" on messages;
create policy "Awardees can mark their messages read" on messages
  for update to authenticated
  using (
    grant_id in (
      select g.id from grants g
      where g.awardee_id in (select my_awardee_ids())
    )
  )
  with check (
    grant_id in (
      select g.id from grants g
      where g.awardee_id in (select my_awardee_ids())
    )
  );

-- Block 11: Update impact_indicators RLS
drop policy if exists "impact_indicators: awardee read own" on grant_impact_indicators;
create policy "impact_indicators: awardee read own" on grant_impact_indicators
  for select using (
    grant_id in (
      select g.id from grants g
      where g.awardee_id in (select my_awardee_ids())
    )
  );

-- Block 12: Update impact_submissions RLS
drop policy if exists "impact_submissions: awardee insert own" on impact_submissions;
create policy "impact_submissions: awardee insert own" on impact_submissions
  for insert with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from grant_impact_indicators i
      join grants g on g.id = i.grant_id
      where i.id = impact_submissions.indicator_id
        and g.awardee_id in (select my_awardee_ids())
    )
  );
