/**
 * lib/quiz-actions.ts
 * Server actions for quiz and quiz_question CRUD, plus quiz assignment.
 *
 * Auth pattern:
 *  1. Verify caller via createClient() (SSR) — role must be 'supervisor'.
 *  2. org_id is read from JWT app_metadata, never from client input.
 *  3. All DB reads and writes use the same SSR client. RLS enforces org
 *     isolation on every table (supervisor policies scope to org_id from JWT).
 *  4. quiz_assignments writes perform an explicit supervisee check (profiles
 *     .supervisor_id = caller.id) in addition to what RLS enforces, because
 *     that check is cross-table and the explicit guard gives a clear error.
 */
'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  QuizInsert,
  QuizUpdate,
  QuizQuestionInsert,
  QuizQuestionUpdate,
  QuizAssignmentInsert,
  JobRoleQuizInsert,
} from '@/lib/database.types'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function requireSupervisor(): Promise<{
  id: string
  orgId: string
} | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'supervisor') return null
  const orgId: string | undefined = user.app_metadata?.org_id
  if (!orgId) return null
  return { id: user.id, orgId }
}

/**
 * Verifies that profileId belongs to the given supervisor.
 * Uses the SSR client; RLS scopes the read to the supervisor's org automatically.
 */
async function verifySupervisee(
  supervisorId: string,
  profileId:    string,
): Promise<boolean> {
  const { data } = await createClient()
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('supervisor_id', supervisorId)
    .maybeSingle()
  return data !== null
}

// ─── Quiz CRUD ────────────────────────────────────────────────────────────────

export async function createQuiz(
  name: string,
  description: string,
): Promise<{ id: string | null; error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { id: null, error: 'Unauthorized' }

  // orgId from JWT — not from client input.
  const row: QuizInsert = {
    org_id:      caller.orgId,
    name:        name.trim(),
    description: description.trim(),
    created_by:  caller.id,
  }
  const { data, error } = await createClient()
    .from('quizzes')
    .insert(row)
    .select('id')
    .single()

  if (error) {
    return {
      id: null,
      error: error.message.includes('unique') || error.code === '23505'
        ? `A quiz named "${name.trim()}" already exists.`
        : error.message,
    }
  }
  return { id: data.id, error: null }
}

export async function updateQuiz(
  id: string,
  patch: { name?: string; description?: string },
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  const update: QuizUpdate = {}
  if (patch.name        !== undefined) update.name        = patch.name.trim()
  if (patch.description !== undefined) update.description = patch.description.trim()

  // Scope to caller's org — RLS also enforces this; belt-and-suspenders.
  const { error } = await createClient()
    .from('quizzes')
    .update(update)
    .eq('id', id)
    .eq('org_id', caller.orgId)

  if (error) {
    return {
      error: error.message.includes('unique') || error.code === '23505'
        ? 'A quiz with that name already exists.'
        : error.message,
    }
  }
  return { error: null }
}

export async function deleteQuiz(
  id: string,
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  const { error } = await createClient()
    .from('quizzes')
    .delete()
    .eq('id', id)
    .eq('org_id', caller.orgId)

  if (error) {
    // The quizzes_delete_guard trigger surfaces a user-readable message.
    return { error: error.message }
  }
  return { error: null }
}

// ─── Helpers for quiz/question ownership ─────────────────────────────────────

/** Verify that quizId belongs to the calling supervisor's org. */
async function verifyQuizOwnership(quizId: string, orgId: string): Promise<boolean> {
  const { data } = await createClient()
    .from('quizzes')
    .select('id')
    .eq('id', quizId)
    .eq('org_id', orgId)
    .maybeSingle()
  return data !== null
}

/**
 * Check that all questions in quizId are complete (multiple_choice with ≥2
 * non-empty options and correct_option set).  Returns a human-readable error
 * string if incomplete, or null when the quiz is ready to assign.
 */
async function verifyQuizComplete(quizId: string): Promise<string | null> {
  const { data: questions } = await createClient()
    .from('quiz_questions')
    .select('id, kind, prompt, options, correct_option')
    .eq('quiz_id', quizId)

  if (!questions || questions.length === 0) {
    return 'This quiz has no questions.'
  }

  let incompleteCount = 0
  for (const q of questions) {
    const opts: string[] = Array.isArray(q.options) ? q.options : []
    const nonEmpty = opts.filter((o: string) => o.trim() !== '').length
    if (nonEmpty < 2 || q.correct_option === null || q.correct_option === undefined) {
      incompleteCount++
    }
  }

  if (incompleteCount > 0) {
    return `This quiz has ${incompleteCount} incomplete question${incompleteCount !== 1 ? 's' : ''} (fewer than 2 non-empty options or no correct answer marked).`
  }

  return null
}

/** Verify that questionId's parent quiz belongs to the calling supervisor's org. */
async function verifyQuestionOwnership(questionId: string, orgId: string): Promise<boolean> {
  const { data } = await createClient()
    .from('quiz_questions')
    .select('quiz_id, quizzes!inner(org_id)')
    .eq('id', questionId)
    .eq('quizzes.org_id', orgId)
    .maybeSingle()
  return data !== null
}

// ─── Quiz question CRUD ───────────────────────────────────────────────────────

export async function createQuestion(
  quizId: string,
  kind: 'multiple_choice',
  orderIndex: number,
): Promise<{ id: string | null; error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { id: null, error: 'Unauthorized' }

  if (kind !== 'multiple_choice') {
    return { id: null, error: 'Only multiple-choice questions are supported.' }
  }

  if (!await verifyQuizOwnership(quizId, caller.orgId)) {
    return { id: null, error: 'Quiz not found in your organisation.' }
  }

  // Seed with valid defaults so DB constraints pass immediately.
  const row: QuizQuestionInsert = {
    quiz_id:        quizId,
    kind,
    prompt:         'New question',
    options:        ['Option A', 'Option B'],
    correct_option: 0,
    order_index:    orderIndex,
  }

  const { data, error } = await createClient()
    .from('quiz_questions')
    .insert(row)
    .select('id')
    .single()

  if (error) return { id: null, error: error.message }
  return { id: data.id, error: null }
}

export async function updateQuestion(
  id: string,
  patch: QuizQuestionUpdate,
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  if (!await verifyQuestionOwnership(id, caller.orgId)) {
    return { error: 'Question not found in your organisation.' }
  }

  const { error } = await createClient()
    .from('quiz_questions')
    .update(patch)
    .eq('id', id)

  if (error) return { error: error.message }
  return { error: null }
}

export async function deleteQuestion(
  id: string,
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  if (!await verifyQuestionOwnership(id, caller.orgId)) {
    return { error: 'Question not found in your organisation.' }
  }

  const { error } = await createClient()
    .from('quiz_questions')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  return { error: null }
}

/**
 * Reorder questions by writing new order_index values in bulk.
 * Receives the ordered array of IDs in the new order.
 * Verifies org ownership of the first question's parent quiz only —
 * all IDs in the array must belong to the same quiz (caller's responsibility).
 */
export async function reorderQuestions(
  orderedIds: string[],
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  if (orderedIds.length === 0) return { error: null }

  // Verify org ownership via the first ID (all belong to the same quiz).
  if (!await verifyQuestionOwnership(orderedIds[0]!, caller.orgId)) {
    return { error: 'Question not found in your organisation.' }
  }

  const db = createClient()
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await db
      .from('quiz_questions')
      .update({ order_index: i })
      .eq('id', orderedIds[i]!)
    if (error) return { error: error.message }
  }
  return { error: null }
}

// ─── job_role_quizzes ─────────────────────────────────────────────────────────

export async function attachQuizToRole(
  jobRoleId: string,
  quizId: string,
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  // Verify both the quiz and the job role belong to the caller's org.
  const db = createClient()
  const [quizOk, roleOk] = await Promise.all([
    verifyQuizOwnership(quizId, caller.orgId),
    db
      .from('job_roles')
      .select('id')
      .eq('id', jobRoleId)
      .eq('org_id', caller.orgId)
      .maybeSingle()
      .then(({ data }) => data !== null),
  ])
  if (!quizOk) return { error: 'Quiz not found in your organisation.' }
  if (!roleOk) return { error: 'Job role not found in your organisation.' }

  // B5: block attaching an incomplete quiz
  const incomplete = await verifyQuizComplete(quizId)
  if (incomplete) return { error: incomplete }

  const row: JobRoleQuizInsert = { job_role_id: jobRoleId, quiz_id: quizId }
  const { error } = await db
    .from('job_role_quizzes')
    .insert(row)

  if (error) {
    if (error.code === '23505') return { error: null }
    return { error: error.message }
  }
  return { error: null }
}

export async function detachQuizFromRole(
  jobRoleId: string,
  quizId: string,
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  const db = createClient()
  const { data: role } = await db
    .from('job_roles')
    .select('id')
    .eq('id', jobRoleId)
    .eq('org_id', caller.orgId)
    .maybeSingle()
  if (!role) return { error: 'Job role not found in your organisation.' }

  const { error } = await db
    .from('job_role_quizzes')
    .delete()
    .eq('job_role_id', jobRoleId)
    .eq('quiz_id', quizId)

  if (error) return { error: error.message }
  return { error: null }
}

/**
 * Count how many people are currently assigned a quiz.
 * Used in the delete-confirmation UI.
 */
export async function countQuizAssignments(
  quizId: string,
): Promise<{ count: number; error: string | null }> {
  if (!await requireSupervisor()) return { count: 0, error: 'Unauthorized' }

  const { count, error } = await createClient()
    .from('quiz_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('quiz_id', quizId)

  if (error) return { count: 0, error: error.message }
  return { count: count ?? 0, error: null }
}

// (scoreAnswer removed — all questions are multiple-choice and auto-scored by trigger)

// ─── Quiz assignment ──────────────────────────────────────────────────────────

/**
 * Assign a quiz to an intern.
 *
 * Explicit supervisee check runs before the write. RLS policy
 * "quiz_assignments: supervisor insert" enforces the same rule — the explicit
 * check is defence-in-depth and produces a clear error message.
 */
export async function assignQuiz(
  profileId: string,
  quizId:    string,
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  const isSupervisee = await verifySupervisee(caller.id, profileId)
  if (!isSupervisee) return { error: 'This intern is not assigned to you.' }

  // B5: block assigning an incomplete quiz
  const incomplete = await verifyQuizComplete(quizId)
  if (incomplete) return { error: incomplete }

  const row: QuizAssignmentInsert = {
    org_id:      caller.orgId,
    quiz_id:     quizId,
    profile_id:  profileId,
    assigned_by: caller.id,
  }

  const { error } = await createClient()
    .from('quiz_assignments')
    .insert(row)

  if (error) {
    if (error.code === '23505') {
      return { error: 'This quiz is already assigned to that person.' }
    }
    return { error: error.message }
  }
  return { error: null }
}

/**
 * Unassign a quiz from an intern (delete the assignment row).
 * Only allowed while status is 'assigned' — cannot remove a submitted quiz.
 * Explicit supervisee check enforced before deletion.
 */
export async function unassignQuiz(
  assignmentId: string,
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  const db = createClient()

  // Fetch the assignment to verify ownership before deleting.
  const { data: assignment, error: fetchErr } = await db
    .from('quiz_assignments')
    .select('profile_id, status')
    .eq('id', assignmentId)
    .maybeSingle()

  if (fetchErr) return { error: fetchErr.message }
  if (!assignment) return { error: 'Assignment not found.' }

  // Supervisee check.
  const isSupervisee = await verifySupervisee(caller.id, assignment.profile_id)
  if (!isSupervisee) return { error: 'This assignment does not belong to one of your interns.' }

  if (assignment.status === 'submitted' || assignment.status === 'published') {
    return { error: 'A submitted or published assignment cannot be removed.' }
  }

  const { error } = await db
    .from('quiz_assignments')
    .delete()
    .eq('id', assignmentId)

  if (error) return { error: error.message }
  return { error: null }
}

// ─── Supervisor feedback ──────────────────────────────────────────────────────

/**
 * Save overall feedback on a published assignment.
 *
 * The assignment is auto-published by the submitQuiz action (service-role),
 * so supervisors only write feedback — no publish step needed.
 * Allowed for both 'submitted' and 'published' statuses.
 */
export async function saveFeedback(
  assignmentId:    string,
  overallFeedback: string | null,
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  const db = createClient()

  const { data: assignment, error: fetchErr } = await db
    .from('quiz_assignments')
    .select('id, profile_id, status')
    .eq('id', assignmentId)
    .maybeSingle()

  if (fetchErr) return { error: fetchErr.message }
  if (!assignment) return { error: 'Assignment not found.' }
  if (!['submitted', 'published'].includes(assignment.status)) {
    return { error: 'Feedback can only be saved for submitted or published assignments.' }
  }

  const isSupervisee = await verifySupervisee(caller.id, assignment.profile_id)
  if (!isSupervisee) return { error: 'This assignment does not belong to one of your interns.' }

  const { error } = await db
    .from('quiz_assignments')
    .update({
      overall_feedback: overallFeedback?.trim() || null,
      reviewed_by:      caller.id,
    })
    .eq('id', assignmentId)

  if (error) return { error: error.message }
  return { error: null }
}

/**
 * Save a supervisor comment on a single answer row (D11).
 *
 * Supervisor must own the assignment (their supervisee).
 * The assignment must be submitted or published.
 */
export async function saveAnswerComment(
  answerId: string,
  comment:  string | null,
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  const db = createClient()

  // Fetch the answer + assignment to verify ownership.
  const { data: answer, error: fetchErr } = await db
    .from('quiz_answers')
    .select(`
      id,
      assignment_id,
      quiz_assignments!inner ( profile_id, status )
    `)
    .eq('id', answerId)
    .maybeSingle() as unknown as {
      data: {
        id: string
        assignment_id: string
        quiz_assignments: { profile_id: string; status: string }
      } | null
      error: { message: string } | null
    }

  if (fetchErr) return { error: fetchErr.message }
  if (!answer)  return { error: 'Answer not found.' }

  if (!['submitted', 'published'].includes(answer.quiz_assignments.status)) {
    return { error: 'Comments can only be added to submitted or published assignments.' }
  }

  const isSupervisee = await verifySupervisee(caller.id, answer.quiz_assignments.profile_id)
  if (!isSupervisee) return { error: 'This assignment does not belong to one of your interns.' }

  const { error } = await db
    .from('quiz_answers')
    .update({ supervisor_comment: comment?.trim() || null })
    .eq('id', answer.id)

  if (error) return { error: error.message }
  return { error: null }
}
