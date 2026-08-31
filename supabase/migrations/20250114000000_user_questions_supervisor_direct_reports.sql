-- ============================================================
-- Compass — narrow user_questions supervisor read policy
--
-- The previous policy let any supervisor read every question
-- from their entire organisation.  This replaces it with a
-- direct-reports-only check: a supervisor may read a row only
-- when the questioner's profile has supervisor_id = auth.uid(),
-- matching the pattern already used by quiz_assignments.
--
-- The intern insert policy is left unchanged.
-- ============================================================

-- Drop the broad org-scoped read policy.
drop policy "user_questions: supervisor reads own org"
  on public.user_questions;

-- Supervisors read only questions asked by their direct reports.
create policy "user_questions: supervisor reads direct reports"
  on public.user_questions
  for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and exists (
      select 1 from public.profiles p
      where p.id   = user_questions.user_id
        and p.supervisor_id = auth.uid()
    )
  );
