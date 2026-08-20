-- ============================================================
-- Compass — change profiles.start_date from text to date
-- ============================================================
--
-- text was added in the previous migration; no data exists in this
-- column yet, so the cast is safe and there are no existing rows
-- to coerce.

alter table public.profiles
  alter column start_date type date using start_date::date;
