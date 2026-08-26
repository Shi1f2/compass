/**
 * lib/intern-quiz-actions.ts
 * Server Actions for the intern quiz-answering flow.
 *
 * Auth pattern:
 *  - createClient() (SSR, anon key) is used for auth.getUser() and all DB
 *    reads and writes. The SSR mutation type bug was fixed in @supabase/ssr
 *    0.12.4 — createServerClient now resolves mutation types correctly.
 *  - For submitQuiz: the admin (service-role) client is used to set
 *    status='published' and published_at=NOW() in a single step. This bypasses
 *    the intern column-guard trigger that blocks interns from setting
 *    published_at. The admin write is gated behind the pre-flight ownership
 *    check on the SSR client — no RLS weakening.
 *  - We never accept org_id, profile_id, or assignment ownership as parameters;
 *    all ownership context is resolved from the JWT and enforced by RLS.
 *    The explicit .eq('profile_id', caller.id) on pre-flight reads provides a
 *    clean error message; the RLS policy would block the write regardless.
 *
 * saveAnswer   — upsert one answer row (called per question while the intern works)
 * submitQuiz   — flip assignment status to 'published' immediately (auto-publish)
 */
'use server'

import 'server-only'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

  // Defect 3: promote the assignment to 'in_progress' once the intern starts
  // answering.  The intern column guard on quiz_assignments permits status
  // changes by interns, so the SSR client is sufficient — no admin client
  // needed.  Non-fatal: a failure here must not lose the saved answer.
  if (assignment.status === 'assigned') {
    await db
      .from('quiz_assignments')
      .update({ status: 'in_progress' })
      .eq('id', assignmentId)
      .eq('profile_id', caller.id)  // belt-and-suspenders ownership check
  }

  return { error: null }
}

// ─── submitQuiz ───────────────────────────────────────────────────────────────

/**
 * Mark an assignment as published (auto-publish on submission).
 *
 * Pre-flight: SSR client verifies the calling intern owns the assignment.
 * Write: admin (service-role) client sets status='published' and
 *        published_at=now(). This bypasses the intern column-guard trigger
 *        which blocks interns from setting published_at directly.
 * The existing quiz_assignments_completed_at_guard trigger is NOT weakened —
 * it still fires on the admin write (triggers fire regardless of auth.jwt()).
 * completed_at is handled by the trigger for the submitted→published path.
 */
export async function submitQuiz(
  assignmentId: string,
): Promise<{ error: string | null }> {
  const caller = await requireIntern()
  if (!caller) return { error: 'Not authenticated as an intern.' }

  const db = createClient()

  // Pre-flight ownership + idempotency check using the intern's own client.
  const { data: assignment } = await db
    .from('quiz_assignments')
    .select('id, status')
    .eq('id', assignmentId)
    .eq('profile_id', caller.id)
    .maybeSingle()

  if (!assignment) return { error: 'Assignment not found.' }
  if (assignment.status === 'published') {
    return { error: 'Already submitted.' }
  }

  // Use the admin client to set status='published' and published_at simultaneously.
  // This is necessary because the intern column-guard trigger rejects published_at
  // changes made by intern-role callers. The admin client bypasses auth.jwt() checks
  // in the trigger, but the ownership check above is the real gating condition.
  const admin = createAdminClient()
  const { error } = await admin
    .from('quiz_assignments')
    .update({
      status:       'published',
      published_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)
    .eq('profile_id', caller.id)   // belt-and-suspenders even for admin client

  if (error) return { error: error.message }

  // Revalidate the intern's console page so the server-computed progressPct
  // is refreshed on the next navigation without a manual reload.
  revalidatePath('/console')

  return { error: null }
}
