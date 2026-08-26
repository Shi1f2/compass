-- ============================================================
-- Compass — quiz system overhaul
--
-- Covers (all in one migration to keep a clean dependency order):
--
--  A3  — remove open-answer data; tighten kind CHECK to 'multiple_choice' only
--  C7  — backfill scores for MC answer rows that currently have score IS NULL
--  D11 — add supervisor_comment to quiz_answers; update RLS
--  D12 — rebuild intern_quiz_results view to expose supervisor_comment
--  E14 — audit/document RLS policies (no changes needed)
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- PART 1 — A3: Remove open-answer data, tighten kind CHECK
-- ════════════════════════════════════════════════════════════

do $$
declare
  open_q_count  integer;
  open_a_count  integer;
begin
  -- Count open answers that will be deleted
  select count(*) into open_a_count
    from public.quiz_answers ans
    join public.quiz_questions qq on qq.id = ans.question_id
   where qq.kind = 'open';

  -- Count open questions that will be deleted
  select count(*) into open_q_count
    from public.quiz_questions
   where kind = 'open';

  raise notice 'Removing % quiz_answers and % quiz_questions with kind=open',
    open_a_count, open_q_count;
end;
$$;

-- 1a. Delete answer rows for open-answer questions first (FK dependency)
delete from public.quiz_answers
 where question_id in (
   select id from public.quiz_questions where kind = 'open'
 );

-- 1b. Delete the open-answer questions
delete from public.quiz_questions where kind = 'open';

-- 1c. Drop the old kind CHECK that allowed 'open'
alter table public.quiz_questions
  drop constraint if exists quiz_questions_kind_check;

-- The original migration used check (kind in ('multiple_choice', 'open')).
-- Replace with a constraint that only allows 'multiple_choice'.
alter table public.quiz_questions
  add constraint quiz_questions_kind_check
    check (kind = 'multiple_choice');

-- 1d. Drop the open-question helper constraints (they reference kind='open')
alter table public.quiz_questions
  drop constraint if exists quiz_questions_open_check;

-- 1e. Tighten mc_check: model_answer must always be null now.
--     First NULL out any stale model_answer values on MC rows (unlikely but safe).
update public.quiz_questions
   set model_answer = null
 where kind = 'multiple_choice' and model_answer is not null;

alter table public.quiz_questions
  drop constraint if exists quiz_questions_mc_check;

alter table public.quiz_questions
  add constraint quiz_questions_mc_check check (
    options is not null
    and correct_option is not null
    and model_answer is null
  );

-- ════════════════════════════════════════════════════════════
-- PART 2 — C7: Backfill scores for existing unscored MC answers
-- ════════════════════════════════════════════════════════════
--
-- The INSERT auto-score trigger (quiz_answers_auto_score) was added in
-- 20250105000000. Any answer row inserted before that migration may have
-- score IS NULL even for a multiple_choice question. Backfill using the
-- same comparison logic.

do $$
declare
  backfilled_count integer;
begin
  with scored as (
    update public.quiz_answers ans
       set score = case
                     when ans.selected_option = qq.correct_option then 100
                     else 0
                   end
      from public.quiz_questions qq
     where qq.id = ans.question_id
       and qq.kind = 'multiple_choice'
       and ans.score is null
       and ans.selected_option is not null
    returning 1
  )
  select count(*) into backfilled_count from scored;

  raise notice 'Backfilled scores for % quiz_answer rows', backfilled_count;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- PART 3 — D11: Add supervisor_comment to quiz_answers
-- ════════════════════════════════════════════════════════════

alter table public.quiz_answers
  add column if not exists supervisor_comment text;

-- ── RLS policy for intern reads of supervisor_comment ─────────────────────────
--
-- The existing "quiz_answers: supervisor scores" UPDATE policy already covers
-- supervisor writes to supervisor_comment (it allows all-column updates on their
-- supervisees' answers). No new write policy is needed.
--
-- For interns: the existing "quiz_answers: intern reads own pre-publish" covers
-- pre-publish reads. Post-publish, the intern_quiz_results security-definer view
-- (rebuilt in Part 4) exposes supervisor_comment. No additional base-table
-- policy is needed for intern reads.

-- ── Extend intern update guard to block supervisor_comment ────────────────────
--
-- Interns must NOT be able to write supervisor_comment.
-- Extend the existing trigger function to block that column too.

create or replace function public.quiz_answers_intern_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  caller_role := auth.jwt() -> 'app_metadata' ->> 'role';

  if caller_role = 'supervisor' then
    return NEW;
  end if;

  -- Interns cannot change score, scored_by, scored_at, or supervisor_comment.
  if (
    NEW.score              is distinct from OLD.score              or
    NEW.scored_by          is distinct from OLD.scored_by          or
    NEW.scored_at          is distinct from OLD.scored_at          or
    NEW.supervisor_comment is distinct from OLD.supervisor_comment
  ) then
    raise exception
      'quiz_answers: score, scored_by, scored_at, and supervisor_comment may only be set by a supervisor'
      using errcode = 'insufficient_privilege';
  end if;

  return NEW;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- PART 4 — D12: Rebuild intern_quiz_results to expose supervisor_comment
-- ════════════════════════════════════════════════════════════
--
-- supervisor_comment is inserted in the middle of the existing column list
-- (after scored_at, before kind), which violates the CREATE OR REPLACE VIEW
-- rule that new columns may only be appended.  Drop first so the CREATE
-- below is free to define any column order.  Nothing else in the schema
-- depends on this view, so the plain (non-cascading) drop is safe.
-- The grant that follows the CREATE restores the privilege that the drop
-- discards.

drop view if exists public.intern_quiz_results;

create view public.intern_quiz_results
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
    ans.supervisor_comment,
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

-- Re-grant (view was replaced; grant may have been lost)
grant select on public.intern_quiz_results to authenticated;

-- ════════════════════════════════════════════════════════════
-- PART 5 — E14: Audit RLS policies for org-wide sharing
--
-- Findings after auditing 20250102000000, 20250105000000, 20250107000000:
--
--  quizzes             — read/update/delete scope to org_id ✓
--                        INSERT requires created_by = auth.uid() (audit trail only) ✓
--  quiz_questions      — scoped via parent quiz org_id ✓
--  job_roles           — scoped to org_id from JWT ✓
--  task_templates      — scoped to org_id from JWT ✓
--  job_role_quizzes    — scoped via job_roles.org_id ✓
--
-- No read/update/delete policy restricts to created_by anywhere.
-- quiz_assignments supervisor read scopes to direct-reports only (correct, E15).
-- No changes required for E14. Documented no-op.
-- ════════════════════════════════════════════════════════════
