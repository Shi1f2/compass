-- ============================================================
-- Compass — intern SELECT policy on quizzes
--
-- Problem: interns had a SELECT policy on quiz_assignments
-- (their own rows) and on quiz_questions (via assignment), but
-- no policy on quizzes itself.  When PostgREST resolves the
-- embedded join  quiz_assignments → quizzes  for an intern, RLS
-- on quizzes blocks the row, so the join silently returns null
-- instead of the quiz record — crashing any code that reads
-- assignment.quiz.name.
--
-- Fix: add a SELECT policy that allows an intern to read a quiz
-- row if they have an assignment for it.  This mirrors the
-- existing "quiz_questions: intern reads assigned" policy.
-- ============================================================

create policy "quizzes: intern reads assigned"
  on public.quizzes for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'intern'
    and exists (
      select 1 from public.quiz_assignments qa
      where qa.quiz_id    = quizzes.id
        and qa.profile_id = auth.uid()
    )
  );
