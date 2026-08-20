-- ============================================================
-- Compass — quiz_assignments supervisor write policies
--
-- quiz_assignments was created with only a supervisor SELECT
-- policy. Writes (assign/unassign) currently go through the
-- service-role admin client in server actions, which bypasses
-- RLS entirely.
--
-- Policy: keep writes server-action-only (admin client), AND
-- add RLS policies as defence-in-depth so the boundary holds
-- even if the admin client is ever replaced with an SSR client.
-- The supervisee check (target profile must belong to the
-- calling supervisor) is enforced both here and explicitly in
-- the assignQuiz server action.
-- ============================================================

-- Supervisors may assign a quiz to a profile that is one of
-- their supervisees (profiles.supervisor_id = auth.uid()).
create policy "quiz_assignments: supervisor insert"
  on public.quiz_assignments for insert
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and assigned_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = quiz_assignments.profile_id
        and p.supervisor_id = auth.uid()
    )
  );

-- Supervisors may update assignments for their supervisees
-- (e.g. re-opening a submitted assignment).
create policy "quiz_assignments: supervisor update"
  on public.quiz_assignments for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and exists (
      select 1 from public.profiles p
      where p.id = quiz_assignments.profile_id
        and p.supervisor_id = auth.uid()
    )
  );

-- Supervisors may unassign a quiz from their supervisees.
create policy "quiz_assignments: supervisor delete"
  on public.quiz_assignments for delete
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and exists (
      select 1 from public.profiles p
      where p.id = quiz_assignments.profile_id
        and p.supervisor_id = auth.uid()
    )
  );
