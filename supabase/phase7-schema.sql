-- ============================================================
-- GrantFlow Phase 7: Document Management Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  grant_id      uuid not null references grants (id) on delete cascade,
  milestone_id  uuid references milestones (id) on delete set null,
  uploaded_by   uuid not null references profiles (id),
  name          text not null,          -- original filename
  storage_path  text not null unique,   -- path in Supabase Storage bucket
  mime_type     text,
  size_bytes    bigint,
  description   text,
  created_at    timestamptz not null default now()
);

create index if not exists documents_grant_id_idx     on documents (grant_id);
create index if not exists documents_milestone_id_idx on documents (milestone_id);

alter table documents enable row level security;

-- Staff can read all documents
create policy "documents: staff read" on documents
  for select using (
    current_user_role() in ('admin', 'program_manager', 'finance_officer', 'auditor')
  );

-- Awardees can read their own grant's documents
create policy "documents: awardee read own" on documents
  for select using (
    grant_id in (
      select g.id from grants g
      join awardees a on g.awardee_id = a.id
      where a.user_id = auth.uid()
    )
  );

-- Staff and awardees can insert (upload)
create policy "documents: staff insert" on documents
  for insert with check (
    current_user_role() in ('admin', 'program_manager', 'finance_officer')
  );

create policy "documents: awardee insert own" on documents
  for insert with check (
    uploaded_by = auth.uid()
    and grant_id in (
      select g.id from grants g
      join awardees a on g.awardee_id = a.id
      where a.user_id = auth.uid()
    )
  );

-- Only admin can delete
create policy "documents: admin delete" on documents
  for delete using (current_user_role() = 'admin');
