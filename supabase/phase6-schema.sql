-- ============================================================
-- GrantFlow Phase 6: Notifications Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  title       text not null,
  body        text not null,
  type        text not null,   -- 'milestone_due', 'milestone_overdue', 'expense_submitted',
                               -- 'expense_reviewed', 'disbursement_received', 'grant_status_changed'
  entity_type text,
  entity_id   uuid,
  href        text,            -- optional deep-link
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications (user_id);
create index if not exists notifications_read_idx    on notifications (user_id, read);
create index if not exists notifications_created_idx on notifications (created_at desc);

alter table notifications enable row level security;

-- Users can only see and update their own notifications
create policy "notifications: read own" on notifications
  for select using (user_id = auth.uid());

create policy "notifications: update own" on notifications
  for update using (user_id = auth.uid());

-- Server (service role) inserts — covered by service role bypass
-- Staff can also read all notifications for admin purposes
create policy "notifications: staff read all" on notifications
  for select using (
    current_user_role() in ('admin', 'program_manager')
  );
