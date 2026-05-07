-- ============================================================
-- GrantFlow Phase 1 Schema
-- Run this in the Supabase SQL Editor (in order)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
create type user_role as enum (
  'admin',
  'program_manager',
  'finance_officer',
  'auditor',
  'awardee'
);

create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  full_name   text,
  role        user_role not null default 'awardee',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create profile on user sign-up
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- 2. AWARDEES
-- ============================================================
create type awardee_type as enum ('individual', 'team', 'organization');

create table awardees (
  id                uuid primary key default gen_random_uuid(),
  -- Linked user account (set after invitation accepted)
  user_id           uuid references profiles (id) on delete set null,
  full_name         text not null,
  email             text not null unique,
  phone             text,
  awardee_type      awardee_type not null default 'individual',
  -- University-specific fields
  student_number    text,
  department        text,
  faculty           text,
  supervisor_name   text,
  supervisor_email  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- 3. GRANTS
-- ============================================================
create type grant_status as enum ('active', 'completed', 'suspended', 'cancelled');

create table grants (
  id              uuid primary key default gen_random_uuid(),
  awardee_id      uuid not null references awardees (id) on delete restrict,
  title           text not null,
  description     text,
  grant_type      text not null,    -- e.g. 'research', 'innovation', 'travel'
  status          grant_status not null default 'active',
  amount_awarded  numeric(14, 2) not null check (amount_awarded > 0),
  currency_code   char(3) not null default 'ZAR',
  start_date      date not null,
  end_date        date not null,
  check (end_date > start_date),
  created_by      uuid not null references profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- 4. MILESTONES
-- ============================================================
create type milestone_status as enum (
  'not_started',
  'in_progress',
  'completed',
  'delayed'
);

create table milestones (
  id            uuid primary key default gen_random_uuid(),
  grant_id      uuid not null references grants (id) on delete cascade,
  title         text not null,
  description   text,
  deliverables  text,
  due_date      date not null,
  status        milestone_status not null default 'not_started',
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 5. AUDIT LOG
-- ============================================================
create table audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references profiles (id) on delete set null,
  action        text not null,       -- e.g. 'grant.created', 'milestone.status_changed'
  entity_type   text not null,       -- e.g. 'grant', 'milestone', 'awardee'
  entity_id     uuid not null,
  old_data      jsonb,
  new_data      jsonb,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- 6. INDEXES
-- ============================================================
create index on awardees (email);
create index on grants (awardee_id);
create index on grants (status);
create index on milestones (grant_id);
create index on milestones (status);
create index on milestones (due_date);
create index on audit_logs (entity_type, entity_id);
create index on audit_logs (actor_id);

-- ============================================================
-- 7. UPDATED_AT TRIGGER (applies to all tables with updated_at)
-- ============================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on profiles
  for each row execute procedure set_updated_at();

create trigger set_awardees_updated_at
  before update on awardees
  for each row execute procedure set_updated_at();

create trigger set_grants_updated_at
  before update on grants
  for each row execute procedure set_updated_at();

create trigger set_milestones_updated_at
  before update on milestones
  for each row execute procedure set_updated_at();

-- ============================================================
-- 8. ROW-LEVEL SECURITY
-- ============================================================
alter table profiles   enable row level security;
alter table awardees   enable row level security;
alter table grants     enable row level security;
alter table milestones enable row level security;
alter table audit_logs enable row level security;

-- Helper: get current user's role
create or replace function current_user_role()
returns user_role
language sql
security definer
stable
as $$
  select role from profiles where id = auth.uid();
$$;

-- profiles: users see their own row; admins/managers see all
create policy "profiles: own row" on profiles
  for select using (id = auth.uid());

create policy "profiles: staff read all" on profiles
  for select using (
    current_user_role() in ('admin', 'program_manager', 'finance_officer', 'auditor')
  );

create policy "profiles: admin update role" on profiles
  for update using (current_user_role() = 'admin');

-- awardees: staff can read all; awardees see their own record
create policy "awardees: staff read" on awardees
  for select using (
    current_user_role() in ('admin', 'program_manager', 'finance_officer', 'auditor')
  );

create policy "awardees: own record" on awardees
  for select using (user_id = auth.uid());

create policy "awardees: admin/pm write" on awardees
  for all using (
    current_user_role() in ('admin', 'program_manager')
  );

-- grants: staff read all; awardees see their own grants
create policy "grants: staff read" on grants
  for select using (
    current_user_role() in ('admin', 'program_manager', 'finance_officer', 'auditor')
  );

create policy "grants: awardee read own" on grants
  for select using (
    awardee_id in (
      select id from awardees where user_id = auth.uid()
    )
  );

create policy "grants: admin/pm write" on grants
  for all using (
    current_user_role() in ('admin', 'program_manager')
  );

-- milestones: follow grant access
create policy "milestones: staff read" on milestones
  for select using (
    current_user_role() in ('admin', 'program_manager', 'finance_officer', 'auditor')
  );

create policy "milestones: awardee read own" on milestones
  for select using (
    grant_id in (
      select g.id from grants g
      join awardees a on g.awardee_id = a.id
      where a.user_id = auth.uid()
    )
  );

create policy "milestones: admin/pm write" on milestones
  for all using (
    current_user_role() in ('admin', 'program_manager')
  );

-- audit_logs: staff read only, no direct writes (inserted via server actions)
create policy "audit_logs: staff read" on audit_logs
  for select using (
    current_user_role() in ('admin', 'auditor')
  );
