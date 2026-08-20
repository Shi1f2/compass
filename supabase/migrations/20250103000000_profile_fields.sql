-- ============================================================
-- Compass — add optional profile fields
-- ============================================================
--
-- Adds three nullable text columns to profiles so supervisors can
-- record a starter's job title, team, and start date when inviting them.
-- All columns are optional (nullable) so existing rows are unaffected.

alter table public.profiles
  add column job_title  text,
  add column team       text,
  add column start_date text;
