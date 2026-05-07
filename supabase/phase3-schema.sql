-- ============================================================
-- GrantFlow Phase 3: Financial Tracking Schema
-- Run this in the Supabase SQL Editor AFTER phase 1 schema
-- ============================================================

-- ── ENUMS ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE disbursement_method AS ENUM ('EFT', 'Cash', 'Cheque', 'Mobile Money', 'Other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE expense_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── BUDGETS ──────────────────────────────────────────────────────────────────
-- Budget allocation per grant, optionally linked to a milestone

create table budgets (
  id                uuid primary key default gen_random_uuid(),
  grant_id          uuid not null references grants (id) on delete cascade,
  milestone_id      uuid references milestones (id) on delete set null,
  category          text not null,
  description       text,
  amount_allocated  numeric(14, 2) not null check (amount_allocated > 0),
  currency_code     char(3) not null default 'ZAR',
  approved          boolean not null default false,
  approved_by       uuid references profiles (id) on delete set null,
  approved_at       timestamptz,
  created_by        uuid not null references profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── DISBURSEMENTS ────────────────────────────────────────────────────────────
-- Actual payments made to the awardee

create table disbursements (
  id                  uuid primary key default gen_random_uuid(),
  grant_id            uuid not null references grants (id) on delete restrict,
  milestone_id        uuid references milestones (id) on delete set null,
  amount              numeric(14, 2) not null check (amount > 0),
  currency_code       char(3) not null default 'ZAR',
  disbursement_date   date not null,
  method              disbursement_method not null default 'EFT',
  reference           text,
  notes               text,
  recorded_by         uuid not null references profiles (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── EXPENSES ─────────────────────────────────────────────────────────────────
-- Expense reports submitted by awardees

create table expenses (
  id            uuid primary key default gen_random_uuid(),
  grant_id      uuid not null references grants (id) on delete restrict,
  milestone_id  uuid references milestones (id) on delete set null,
  submitted_by  uuid not null references profiles (id),
  description   text not null,
  category      text not null,
  amount        numeric(14, 2) not null check (amount > 0),
  currency_code char(3) not null default 'ZAR',
  expense_date  date not null,
  status        expense_status not null default 'pending',
  receipt_url   text,
  reviewed_by   uuid references profiles (id) on delete set null,
  reviewed_at   timestamptz,
  review_notes  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── INDEXES ──────────────────────────────────────────────────────────────────

create index on budgets (grant_id);
create index on budgets (approved);
create index on disbursements (grant_id);
create index on disbursements (disbursement_date);
create index on expenses (grant_id);
create index on expenses (submitted_by);
create index on expenses (status);

-- ── UPDATED_AT TRIGGERS ──────────────────────────────────────────────────────

create trigger set_budgets_updated_at
  before update on budgets
  for each row execute procedure set_updated_at();

create trigger set_disbursements_updated_at
  before update on disbursements
  for each row execute procedure set_updated_at();

create trigger set_expenses_updated_at
  before update on expenses
  for each row execute procedure set_updated_at();

-- ── ROW-LEVEL SECURITY ───────────────────────────────────────────────────────

alter table budgets      enable row level security;
alter table disbursements enable row level security;
alter table expenses     enable row level security;

-- budgets: staff read/write, awardees read their own
create policy "budgets: staff read" on budgets
  for select using (
    current_user_role() in ('admin', 'program_manager', 'finance_officer', 'auditor')
  );

create policy "budgets: awardee read own" on budgets
  for select using (
    grant_id in (
      select g.id from grants g
      join awardees a on g.awardee_id = a.id
      where a.user_id = auth.uid()
    )
  );

create policy "budgets: finance/admin/pm write" on budgets
  for all using (
    current_user_role() in ('admin', 'program_manager', 'finance_officer')
  );

-- disbursements: staff read/write, awardees read their own
create policy "disbursements: staff read" on disbursements
  for select using (
    current_user_role() in ('admin', 'program_manager', 'finance_officer', 'auditor')
  );

create policy "disbursements: awardee read own" on disbursements
  for select using (
    grant_id in (
      select g.id from grants g
      join awardees a on g.awardee_id = a.id
      where a.user_id = auth.uid()
    )
  );

create policy "disbursements: finance/admin write" on disbursements
  for all using (
    current_user_role() in ('admin', 'finance_officer')
  );

-- expenses: staff read all; awardees submit and see their own
create policy "expenses: staff read" on expenses
  for select using (
    current_user_role() in ('admin', 'program_manager', 'finance_officer', 'auditor')
  );

create policy "expenses: awardee read own" on expenses
  for select using (submitted_by = auth.uid());

create policy "expenses: awardee insert" on expenses
  for insert with check (
    submitted_by = auth.uid()
    and current_user_role() = 'awardee'
  );

create policy "expenses: admin/finance update" on expenses
  for update using (
    current_user_role() in ('admin', 'finance_officer')
  );
