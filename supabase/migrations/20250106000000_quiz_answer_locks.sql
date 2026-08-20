-- ============================================================
-- Compass — quiz answer submission lock + UPDATE auto-score
-- Extends the quiz system from 20250105000000_quizzes.sql
-- ============================================================

-- ─── 1. Extend auto-score to cover BEFORE UPDATE ─────────────────────────────
--
-- The INSERT trigger already exists (quiz_answers_auto_score).
-- An intern may change a multiple-choice answer before submitting, so we
-- need the same scoring logic to fire on UPDATE as well.
-- Open answers: score stays null on update too — supervisor-only.

create or replace function public.quiz_answers_auto_score_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  q_kind           text;
  q_correct_option integer;
begin
  -- Only re-score when selected_option actually changed.
  if NEW.selected_option is not distinct from OLD.selected_option then
    return NEW;
  end if;

  select kind, correct_option
    into q_kind, q_correct_option
    from public.quiz_questions
   where id = NEW.question_id;

  if q_kind = 'multiple_choice' then
    if NEW.selected_option = q_correct_option then
      NEW.score := 100;
    else
      NEW.score := 0;
    end if;
  end if;

  return NEW;
end;
$$;

create trigger quiz_answers_auto_score_update
  before update on public.quiz_answers
  for each row
  -- Fire only for interns changing their own answer content; supervisors
  -- touching score/scored_by/scored_at are handled by the intern update
  -- guard and never need re-scoring.
  execute function public.quiz_answers_auto_score_update();

-- ─── 2. Submission lock — block intern writes once assignment is submitted ────
--
-- Fires BEFORE INSERT and BEFORE UPDATE on quiz_answers.
-- If the parent assignment's status is already 'submitted':
--   - block interns from inserting or updating any answer
--   - supervisors are allowed through (they score open answers post-submission)
--
-- RLS alone is insufficient here: the intern UPDATE policy checks
-- qa.status <> 'submitted', but a concurrent submit could race past it.
-- The trigger is the serialisable boundary.

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

  -- Supervisors may always write answers (for scoring).
  if caller_role = 'supervisor' then
    return NEW;
  end if;

  -- For interns: look up the assignment status.
  select status into assignment_status
    from public.quiz_assignments
   where id = NEW.assignment_id;

  if assignment_status = 'submitted' then
    raise exception
      'quiz_answers: this assignment has already been submitted and cannot be changed'
      using errcode = 'restrict_violation';
  end if;

  return NEW;
end;
$$;

-- INSERT lock
create trigger quiz_answers_submission_lock_insert
  before insert on public.quiz_answers
  for each row
  execute function public.quiz_answers_submission_lock();

-- UPDATE lock (fires before the intern update guard and the update auto-score
-- triggers, so a submitted assignment is blocked before any scoring logic runs)
create trigger quiz_answers_submission_lock_update
  before update on public.quiz_answers
  for each row
  execute function public.quiz_answers_submission_lock();
