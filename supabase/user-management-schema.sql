-- ============================================================
-- GrantFlow: User management additions
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Add is_active flag to profiles (default true for existing users)
alter table profiles
  add column if not exists is_active boolean not null default true;
