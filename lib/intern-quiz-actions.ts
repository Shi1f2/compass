/**
 * lib/intern-quiz-actions.ts
 * Server Actions for the intern quiz-answering flow.
 *
 * Auth pattern:
 *  - createClient() (SSR, anon key) is used for auth.getUser() and all DB
 *    reads and writes. The SSR mutation type bug was fixed in @supabase/ssr
 *    0.12.4 — createServerClient now resolves mutation types correctly.
 *  - The service-role admin client is NOT used here. RLS is the real boundary:
 *      quiz_answers: intern inserts own        — profile ownership via assignment
 *      quiz_answers: intern updates own        — same; blocks scoring columns
 *      quiz_assignments: intern updates own    — only status column
 *  - We never accept org_id, profile_id, or assignment ownership as parameters;
 *    all ownership context is resolved from the JWT and enforced by RLS.
 *    The explicit .eq('profile_id', caller.id) on pre-flight reads provides a
 *    clean error message; the RLS policy would block the write regardless.
 *
 * saveAnswer   — upsert one answer row (called per question while the intern works)
 * submitQuiz   — flip assignment status to 'submitted'
 */
'use server'

import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { QuizAnswerInsert } from '@/lib/database.types'

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireIntern(): Promise<{ id: string } | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'intern') return null
  return { id: user.id }
}

// ─── saveAnswer ───────────────────────────────────────────────────────────────

/**
 * Upsert one answer for the calling intern.
 *
 * For multiple_choice: pass selectedOption (0-based index), leave textAnswer null.
 * For open:            pass textAnswer, leave selectedOption null.
 *
 * RLS policy "quiz_answers: intern inserts own" / "intern updates own" enforces
 * that the assignment belongs to the calling user. The pre-flight read below
 * additionally catches the 'submitted' guard before the write.
 */
export async function saveAnswer(
  assignmentId:   string,
  questionId:     string,
  selectedOption: number | null,
  textAnswer:     string | null,
): Promise<{ error: string | null }> {
  const caller = await requireIntern()
  if (!caller) return { error: 'Not authenticated as an intern.' }

  const db = createClient()

  // Pre-flight: confirm the assignment exists and belongs to this intern.
  // RLS blocks the write anyway; this surfaces a clean error message.
  const { data: assignment } = await db
    .from('quiz_assignments')
    .select('id, status')
    .eq('id', assignmentId)
    .eq('profile_id', caller.id)
    .maybeSingle()

  if (!assignment) return { error: 'Assignment not found.' }
  if (assignment.status === 'submitted' || assignment.status === 'published') {
    return { error: 'This quiz has already been submitted.' }
  }

  // Upsert — the unique index on (assignment_id, question_id) means a second
  // save for the same question updates the existing row rather than duplicating.
  const row: QuizAnswerInsert = {
    assignment_id:   assignmentId,
    question_id:     questionId,
    selected_option: selectedOption,
    text_answer:     textAnswer,
  }

  const { error } = await db
    .from('quiz_answers')
    .upsert(row, { onConflict: 'assignment_id,question_id' })

  if (error) return { error: error.message }
  return { error: null }
}

// ─── submitQuiz ───────────────────────────────────────────────────────────────

/**
 * Mark an assignment as submitted.
 *
 * RLS policy "quiz_assignments: intern updates own status" enforces ownership.
 * The trigger quiz_assignments_completed_at_guard fires BEFORE UPDATE and sets
 * completed_at = now() on the submitted transition.
 */
export async function submitQuiz(
  assignmentId: string,
): Promise<{ error: string | null }> {
  const caller = await requireIntern()
  if (!caller) return { error: 'Not authenticated as an intern.' }

  const db = createClient()

  // Pre-flight ownership + idempotency check.
  const { data: assignment } = await db
    .from('quiz_assignments')
    .select('id, status')
    .eq('id', assignmentId)
    .eq('profile_id', caller.id)
    .maybeSingle()

  if (!assignment) return { error: 'Assignment not found.' }
  if (assignment.status === 'submitted' || assignment.status === 'published') {
    return { error: 'Already submitted.' }
  }

  const { error } = await db
    .from('quiz_assignments')
    .update({ status: 'submitted' })
    .eq('id', assignmentId)
    .eq('profile_id', caller.id)   // redundant with RLS; defence-in-depth

  if (error) return { error: error.message }
  return { error: null }
}
