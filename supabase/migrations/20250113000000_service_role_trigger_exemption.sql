-- ============================================================
-- Compass — exempt service-role callers from quiz answer triggers
--
-- Three BEFORE triggers on quiz_answers check the caller's application
-- metadata role and pass supervisors through unconditionally.  The
-- service-role key (used by provisioning, invite, submit, and seed
-- scripts) carries no application metadata; the lookup yields null and
-- the caller falls into the restricted branch, blocking seeding.
--
-- Fix: check the top-level JWT role claim first.  A service-role token
-- sets  auth.jwt() ->> 'role' = 'service_role'  at the top level rather
-- than inside app_metadata, so that is the right place to detect it.
-- When that claim is present, return early — identical to the supervisor
-- exemption that already exists.
--
-- This does not widen any user-facing path.  Browser and SSR clients
-- authenticate as a signed-in user and never carry the service_role
-- claim; no intern or supervisor gains a new capability.
--
-- Functions rewritten here (in the same order they fire alphabetically
-- on BEFORE UPDATE):
--   1. quiz_answers_intern_update_guard  (UPDATE)
--   2. quiz_answers_submission_lock      (INSERT + UPDATE)
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. quiz_answers_intern_update_guard
-- ════════════════════════════════════════════════════════════

create or replace function public.quiz_answers_intern_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role      text;
  q_correct_option integer;
  expected_score   integer;
begin
  -- Privileged callers: supervisor (app metadata) or service role (top-level claim).
  caller_role := auth.jwt() -> 'app_metadata' ->> 'role';
  if caller_role = 'supervisor' then
    return NEW;
  end if;
  if (auth.jwt() ->> 'role') = 'service_role' then
    return NEW;
  end if;

  -- Interns may never change scored_by, scored_at, or supervisor_comment.
  if (
    NEW.scored_by          is distinct from OLD.scored_by          or
    NEW.scored_at          is distinct from OLD.scored_at          or
    NEW.supervisor_comment is distinct from OLD.supervisor_comment
  ) then
    raise exception
      'quiz_answers: score, scored_by, scored_at, and supervisor_comment may only be set by a supervisor'
      using errcode = 'insufficient_privilege';
  end if;

  -- Allow a score change only when it matches what the auto-scoring rule
  -- would produce for the newly chosen option.  This permits the auto-score
  -- UPDATE trigger (which runs first, alphabetically) to legitimately rewrite
  -- the score column without being rejected here.
  if NEW.score is distinct from OLD.score then
    select correct_option
      into q_correct_option
      from public.quiz_questions
     where id = NEW.question_id;

    expected_score := case
      when NEW.selected_option = q_correct_option then 100
      else 0
    end;

    if NEW.score is distinct from expected_score then
      raise exception
        'quiz_answers: score may only be set by a supervisor'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return NEW;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 2. quiz_answers_submission_lock  (shared by INSERT and UPDATE triggers)
-- ════════════════════════════════════════════════════════════

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
  -- Privileged callers: supervisor (app metadata) or service role (top-level claim).
  caller_role := auth.jwt() -> 'app_metadata' ->> 'role';
  if caller_role = 'supervisor' then
    return NEW;
  end if;
  if (auth.jwt() ->> 'role') = 'service_role' then
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
