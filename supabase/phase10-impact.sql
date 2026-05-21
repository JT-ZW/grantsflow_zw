-- ============================================================
-- GrantFlow Phase 10: Impact Reporting
-- Run each block separately in Supabase SQL Editor.
-- ============================================================

-- Block 1: Layer 1 — sector/SDG/geographic classification on grants
alter table grants
  add column if not exists sectors       text[]  default '{}',
  add column if not exists sdg_goals     int[]   default '{}',
  add column if not exists country_codes text[]  default '{}',
  add column if not exists geographic_scope text
    check (geographic_scope in ('local','national','regional','continental','international')),
  add column if not exists beneficiary_type text;

-- Block 2: Layer 2 — impact indicators per grant (admin-defined)
create table if not exists grant_impact_indicators (
  id         uuid primary key default gen_random_uuid(),
  grant_id   uuid not null references grants(id) on delete cascade,
  label      text not null,         -- e.g. "Beneficiaries reached"
  unit       text not null,         -- e.g. "people", "tonnes CO₂", "jobs"
  target_value numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists grant_impact_indicators_grant_id_idx on grant_impact_indicators(grant_id);

alter table grant_impact_indicators enable row level security;

create policy "impact_indicators: staff read"
  on grant_impact_indicators for select
  using (current_user_role() in ('admin','program_manager','finance_officer','auditor'));

create policy "impact_indicators: admin/pm write"
  on grant_impact_indicators for all
  using (current_user_role() in ('admin','program_manager'));

create policy "impact_indicators: awardee read own"
  on grant_impact_indicators for select
  using (
    exists (
      select 1 from grants g
      join awardees a on a.id = g.awardee_id
      where g.id = grant_impact_indicators.grant_id
        and a.user_id = auth.uid()
    )
  );

-- Block 3: Layer 2 — impact actuals submitted by awardees
create table if not exists impact_submissions (
  id                  uuid primary key default gen_random_uuid(),
  indicator_id        uuid not null references grant_impact_indicators(id) on delete cascade,
  milestone_update_id uuid references milestone_updates(id) on delete set null,
  actual_value        numeric not null,
  note                text,
  submitted_by        uuid not null references auth.users(id),
  submitted_at        timestamptz not null default now()
);

create index if not exists impact_submissions_indicator_id_idx on impact_submissions(indicator_id);
create index if not exists impact_submissions_milestone_update_id_idx on impact_submissions(milestone_update_id);

alter table impact_submissions enable row level security;

create policy "impact_submissions: staff read"
  on impact_submissions for select
  using (current_user_role() in ('admin','program_manager','finance_officer','auditor'));

create policy "impact_submissions: awardee insert own"
  on impact_submissions for insert
  with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from grant_impact_indicators i
      join grants g on g.id = i.grant_id
      join awardees a on a.id = g.awardee_id
      where i.id = impact_submissions.indicator_id
        and a.user_id = auth.uid()
    )
  );

create policy "impact_submissions: awardee read own"
  on impact_submissions for select
  using (submitted_by = auth.uid());

-- Block 4: Layer 3 — narrative impact story on milestone_updates
alter table milestone_updates
  add column if not exists impact_story text;
