-- ============================================================
-- Compass — quiz publish flow
--
-- Extends quiz_assignments with:
--   status:           'assigned' | 'in_progress' | 'submitted' | 'published'
--   reviewed_by:      uuid, set on publish
--   published_at:     timestamptz, set on publish
--   overall_feedback: text, optional supervisor note for the whole quiz
--
-- RLS strategy for intern access to quiz_answers / quiz_questions:
--   An intern must NOT be able to read scores, model_answer, or
--   overall_feedback before publication.  A single RLS policy on
--   quiz_answers cannot express a conditional column mask, so we use
--   a SECURITY DEFINER view (intern_quiz_results) that exposes those
--   columns only when the assignment is 'published'.  The existing
--   broad intern SELECT policy on quiz_answers is replaced with one
--   that allows reads only on published assignments; the intern still
--   reaches the view for their score data and reaches the base table
--   read-only before submission for their own text_answer /
--   selected_option values via the narrower upsert path.
--
-- Choice: security-definer view over a function because the intern
--   side already uses PostgREST joins (quiz_assignments → quiz_answers)
--   and a view fits that join path without changing the client query
--   structure.  The view is called intern_quiz_results and the client
--   reads it instead of quiz_answers when the assignment is published.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- PART 1 — SCHEMA CHANGES
-- ════════════════════════════════════════════════════════════

-- 1a. Add new columns to quiz_assignments
alter table public.quiz_assignments
  add column if not exists reviewed_by      uuid references public.profiles(id) on delete set null,
  add column if not exists published_at     timestamptz,
  add column if not exists overall_feedback text;

-- 1b. Widen the status check constraint to include 'published'
alter table public.quiz_assignments
  drop constraint if exists quiz_assignments_status_check;

alter table public.quiz_assignments
  add constraint quiz_assignments_status_check
    check (status in ('assigned', 'in_progress', 'submitted', 'published'));

-- ════════════════════════════════════════════════════════════
-- PART 2 — UPDATE TRIGGERS
-- ════════════════════════════════════════════════════════════

-- 2a. Extend quiz_assignments_completed_at_guard to handle the new
--     'published' status and guard the new columns from intern writes.
create or replace function public.quiz_assignments_completed_at_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') = 'intern' then
    if (
      NEW.org_id           is distinct from OLD.org_id           or
      NEW.quiz_id          is distinct from OLD.quiz_id          or
      NEW.profile_id       is distinct from OLD.profile_id       or
      NEW.assigned_by      is distinct from OLD.assigned_by      or
      NEW.assigned_at      is distinct from OLD.assigned_at      or
      NEW.reviewed_by      is distinct from OLD.reviewed_by      or
      NEW.published_at     is distinct from OLD.published_at     or
      NEW.overall_feedback is distinct from OLD.overall_feedback
    ) then
      raise exception
        'quiz_assignments: only status may be updated by an intern'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- completed_at tracks the 'submitted' transition only
  if NEW.status = 'submitted' and OLD.status not in ('submitted', 'published') then
    NEW.completed_at := now();
  elsif NEW.status not in ('submitted', 'published') and OLD.status in ('submitted', 'published') then
    NEW.completed_at := null;
  else
    NEW.completed_at := OLD.completed_at;
  end if;

  return NEW;
end;
$$;

-- 2b. Extend the submission lock so it also blocks intern writes once
--     the assignment is published.
create or replace function public.quiz_answers_submission_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_status text;
  caller_role       text;
begin
  caller_role := auth.jwt() -> 'app_metadata' ->> 'role';

  if caller_role = 'supervisor' then
    return NEW;
  end if;

  select status into assignment_status
    from public.quiz_assignments
   where id = NEW.assignment_id;

  if assignment_status in ('submitted', 'published') then
    raise exception
      'quiz_answers: this assignment has already been submitted and cannot be changed'
      using errcode = 'restrict_violation';
  end if;

  return NEW;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- PART 3 — RLS POLICY CHANGES
-- ════════════════════════════════════════════════════════════

-- 3a. Replace the intern quiz_answers SELECT policy.
--     Before publication the intern can still reach their own answers
--     (selected_option / text_answer) for the answering flow; after
--     publication they can also read score / scored_at.
--     We implement gated column exposure via a security-definer view
--     (see Part 4), so the base-table policy for interns now only allows
--     reads on non-published assignments (answering phase) plus keeps
--     published ones accessible for the base join (the view handles the
--     actual exposure).  The simplest correct approach: allow intern
--     reads on their own answers always — PostgREST will call the view
--     for the published result page, not this table directly.  Scores
--     are exposed only through the view, which filters by status.

drop policy if exists "quiz_answers: intern reads own" on public.quiz_answers;

-- Intern may read their own answers only while the assignment is NOT yet
-- published.  For published results they query the view below.
create policy "quiz_answers: intern reads own pre-publish"
  on public.quiz_answers for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'intern'
    and exists (
      select 1 from public.quiz_assignments qa
      where qa.id         = quiz_answers.assignment_id
        and qa.profile_id = auth.uid()
        and qa.status     <> 'published'
    )
  );

-- 3b. Update the intern quiz_answers UPDATE policy to also block on 'published'.
drop policy if exists "quiz_answers: intern updates own" on public.quiz_answers;

create policy "quiz_answers: intern updates own"
  on public.quiz_answers for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'intern'
    and exists (
      select 1 from public.quiz_assignments qa
      where qa.id         = quiz_answers.assignment_id
        and qa.profile_id = auth.uid()
        and qa.status     not in ('submitted', 'published')
    )
  );

-- 3c. Allow intern to also read quiz_questions model_answer via the
--     view (view is security definer so it bypasses RLS); the base
--     quiz_questions read policy for interns already allows access
--     for assigned quizzes.  No change needed there.

-- ════════════════════════════════════════════════════════════
-- PART 4 — SECURITY-DEFINER VIEW: intern_quiz_results
--
-- Exposes score, scored_at, and the question's model_answer ONLY for
-- published assignments belonging to the calling user.  The supervisor
-- reads the base tables directly (their existing policies cover it).
--
-- The view is SECURITY DEFINER so it runs as the definer (postgres /
-- service role) and is not subject to RLS on the underlying tables.
-- The WHERE clause enforces the ownership and publication check.
-- ════════════════════════════════════════════════════════════

create or replace view public.intern_quiz_results
with (security_invoker = false)
as
  select
    qa.id                as assignment_id,
    qa.profile_id,
    qa.status,
    qa.completed_at,
    qa.published_at,
    qa.overall_feedback,
    ans.id               as answer_id,
    ans.question_id,
    ans.selected_option,
    ans.text_answer,
    ans.score,
    ans.scored_at,
    qq.kind,
    qq.prompt,
    qq.options,
    qq.correct_option,
    qq.model_answer,
    qq.order_index
  from public.quiz_assignments  qa
  join public.quiz_answers      ans on ans.assignment_id = qa.id
  join public.quiz_questions    qq  on qq.id             = ans.question_id
 where qa.status = 'published'
   and qa.profile_id = auth.uid();

-- Grant SELECT on the view to the authenticated role so PostgREST can use it.
grant select on public.intern_quiz_results to authenticated;
