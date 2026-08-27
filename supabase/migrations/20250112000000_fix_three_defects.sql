-- ============================================================
-- Compass — fix three defects introduced by the quiz overhaul
--
--  Defect 1 — intern column guard blocks valid score changes
--             caused by the auto-score UPDATE trigger running
--             first (alphabetically) and rewriting NEW.score.
--             Fix: allow a score change when it exactly matches
--             the auto-scoring rule for the newly chosen option.
--
--  Defect 2 — completion timestamp never set because submission
--             now skips the 'submitted' state and goes straight
--             to 'published'.
--             Fix: set completed_at on the transition into either
--             'submitted' or 'published', but do not overwrite an
--             existing value.  Backfill published rows that have
--             no completed_at using published_at.
--
--  Defect 3 — assignment status never advances to 'in_progress'.
--             Fix: in the saveAnswer server action (TypeScript),
--             after a successful answer write, promote an
--             'assigned' assignment to 'in_progress'.
--             (The application change is in lib/intern-quiz-actions.ts.)
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- DEFECT 1 — intern column guard: permit auto-score-produced score changes
-- ════════════════════════════════════════════════════════════
--
-- Trigger fire order (alphabetical, BEFORE UPDATE):
--   1. quiz_answers_auto_score_update  — may change NEW.score
--   2. quiz_answers_intern_update_guard — then compares NEW.score to OLD.score
--
-- The guard must allow a score change when it is exactly the value the
-- auto-scoring rule would produce for the newly chosen option on that question.
-- Any other score change by an intern must still raise.

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
  caller_role := auth.jwt() -> 'app_metadata' ->> 'role';

  if caller_role = 'supervisor' then
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
-- DEFECT 2 — completion timestamp: fire on 'published' too
-- ════════════════════════════════════════════════════════════
--
-- Original logic only set completed_at on the → 'submitted' transition.
-- Submission now goes directly assigned/in_progress → 'published', so the
-- timestamp was never written.
--
-- New rules:
--   • Set completed_at := now() when entering 'submitted' or 'published'
--     for the first time (i.e. only if completed_at is currently null).
--   • Clear completed_at if the row moves back out of both states.
--   • Do not touch completed_at on any other transition (preserves existing
--     values and prevents supervisor feedback saves from overwriting the date).

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

  -- Enter a completion state: set completed_at only if not already set.
  if NEW.status in ('submitted', 'published')
     and OLD.status not in ('submitted', 'published') then
    NEW.completed_at := coalesce(OLD.completed_at, now());

  -- Leave both completion states: clear the timestamp.
  elsif NEW.status not in ('submitted', 'published')
        and OLD.status in ('submitted', 'published') then
    NEW.completed_at := null;

  -- Any other transition (including published→published on supervisor saves):
  -- preserve the existing value.
  else
    NEW.completed_at := OLD.completed_at;
  end if;

  return NEW;
end;
$$;

-- Backfill: published assignments that still have no completed_at.
-- Use published_at as the best available approximation of completion time.
--
-- The trigger rewritten above must be disabled for the duration of this
-- UPDATE.  For published→published transitions its else branch preserves
-- OLD.completed_at (null), silently cancelling the write while still
-- reporting rows affected.  Disable only the specific trigger; re-enable
-- it in the very next statement so no later statement in this session can
-- inherit a disabled trigger.

alter table public.quiz_assignments
  disable trigger quiz_assignments_completed_at_guard;

update public.quiz_assignments
   set completed_at = published_at
 where status      = 'published'
   and completed_at is null
   and published_at is not null;

alter table public.quiz_assignments
  enable trigger quiz_assignments_completed_at_guard;

-- Verify the backfill landed.  A non-zero count means rows were skipped
-- (e.g. published_at was also null); raise a notice so it is visible in
-- migration output.
do $$
declare
  missing integer;
begin
  select count(*) into missing
    from public.quiz_assignments
   where status      = 'published'
     and completed_at is null;

  raise notice 'published assignments still missing completed_at after backfill: %', missing;
end;
$$;
