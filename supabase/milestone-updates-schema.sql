-- ============================================================
-- GrantFlow: Add milestone progress notes
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Progress notes column on milestones (awardee-submitted updates)
alter table milestones
  add column if not exists progress_notes text;

-- Separate table for a full progress history per milestone
create table if not exists milestone_updates (
  id            uuid primary key default gen_random_uuid(),
  milestone_id  uuid not null references milestones (id) on delete cascade,
  submitted_by  uuid not null references profiles (id),
  note          text not null,
  status_at     text not null,  -- milestone status at time of update
  created_at    timestamptz not null default now()
);

create index if not exists milestone_updates_milestone_id_idx on milestone_updates (milestone_id);

alter table milestone_updates enable row level security;

-- Awardees can insert updates for their own milestones
create policy "milestone_updates: awardee insert" on milestone_updates
  for insert with check (
    submitted_by = auth.uid()
    and milestone_id in (
      select m.id from milestones m
      join grants g on m.grant_id = g.id
      join awardees a on g.awardee_id = a.id
      where a.user_id = auth.uid()
    )
  );

-- Awardees can read their own milestone updates
create policy "milestone_updates: awardee read" on milestone_updates
  for select using (
    milestone_id in (
      select m.id from milestones m
      join grants g on m.grant_id = g.id
      join awardees a on g.awardee_id = a.id
      where a.user_id = auth.uid()
    )
  );

-- Staff can read all milestone updates
create policy "milestone_updates: staff read" on milestone_updates
  for select using (
    current_user_role() in ('admin', 'program_manager', 'finance_officer', 'auditor')
  );
