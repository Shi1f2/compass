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
  kind: 'multiple_choice' | 'open',
  orderIndex: number,
): Promise<{ id: string | null; error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { id: null, error: 'Unauthorized' }

  if (!await verifyQuizOwnership(quizId, caller.orgId)) {
    return { id: null, error: 'Quiz not found in your organisation.' }
  }

  // Seed with valid defaults so DB constraints pass immediately.
  const row: QuizQuestionInsert = kind === 'multiple_choice'
    ? {
        quiz_id:        quizId,
        kind,
        prompt:         'New question',
        options:        ['Option A', 'Option B'],
        correct_option: 0,
        order_index:    orderIndex,
      }
    : {
        quiz_id:     quizId,
        kind,
        prompt:      'New question',
        model_answer: '',
        order_index: orderIndex,
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

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Score one open-answer response.
 *
 * Rules enforced here (and redundantly by RLS + trigger):
 *  - Caller must be a supervisor.
 *  - The assignment must belong to one of the caller's supervisees.
 *  - The assignment must be submitted (score only after submission).
 *  - The question must be kind='open' — MC is auto-scored; supervisor cannot
 *    override it.
 *  - score must be 0–100.
 *  - scored_by and scored_at are written server-side; never trusted from input.
 */
export async function scoreAnswer(
  answerIdOrQuestionId: string,   // quiz_answers.id
  score: number,
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  if (!Number.isInteger(score) || score < 0 || score > 100) {
    return { error: 'Score must be a whole number between 0 and 100.' }
  }

  const db = createClient()

  // Fetch the answer row, join through to verify supervisee ownership.
  const { data: answer, error: fetchErr } = await db
    .from('quiz_answers')
    .select(`
      id,
      question_id,
      assignment_id,
      quiz_questions!inner ( kind ),
      quiz_assignments!inner ( profile_id, status )
    `)
    .eq('id', answerIdOrQuestionId)
    .maybeSingle() as unknown as {
      data: {
        id: string
        question_id: string
        assignment_id: string
        quiz_questions: { kind: string }
        quiz_assignments: { profile_id: string; status: string }
      } | null
      error: { message: string } | null
    }

  if (fetchErr) return { error: fetchErr.message }
  if (!answer)  return { error: 'Answer not found.' }

  if (!['submitted', 'published'].includes(answer.quiz_assignments.status)) {
    return { error: 'Quiz has not been submitted yet.' }
  }
  if (answer.quiz_questions.kind !== 'open') {
    return { error: 'Multiple-choice questions are scored automatically.' }
  }

  // Supervisee check — the calling supervisor must own this intern.
  const isSupervisee = await verifySupervisee(caller.id, answer.quiz_assignments.profile_id)
  if (!isSupervisee) return { error: 'This assignment does not belong to one of your interns.' }

  const { error } = await db
    .from('quiz_answers')
    .update({
      score,
      scored_by: caller.id,
      scored_at: new Date().toISOString(),
    })
    .eq('id', answer.id)

  if (error) return { error: error.message }
  return { error: null }
}

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

// ─── Publish assignment ───────────────────────────────────────────────────────

/**
 * Publish a submitted assignment so the intern can see the review.
 *
 * Sets status → 'published', published_at, reviewed_by, and optionally
 * overall_feedback in a single update.
 *
 * Pre-condition: every open question must have a score.  The action
 * checks this explicitly and returns the count of unscored open questions
 * in the error so the UI can surface the reason for the disabled state.
 */
export async function publishAssignment(
  assignmentId:    string,
  overallFeedback: string | null,
): Promise<{ error: string | null; unscoredCount?: number }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  const db = createClient()

  // Fetch assignment + verify ownership
  const { data: assignment, error: fetchErr } = await db
    .from('quiz_assignments')
    .select('id, profile_id, status, quiz_id')
    .eq('id', assignmentId)
    .maybeSingle()

  if (fetchErr) return { error: fetchErr.message }
  if (!assignment) return { error: 'Assignment not found.' }
  if (assignment.status !== 'submitted') {
    return { error: 'Only submitted assignments can be published.' }
  }

  const isSupervisee = await verifySupervisee(caller.id, assignment.profile_id)
  if (!isSupervisee) return { error: 'This assignment does not belong to one of your interns.' }

  // Count unscored open questions
  const { data: openAnswers, error: openErr } = await db
    .from('quiz_answers')
    .select('id, score, quiz_questions!inner(kind)')
    .eq('assignment_id', assignmentId) as unknown as {
      data: { id: string; score: number | null; quiz_questions: { kind: string } }[] | null
      error: { message: string } | null
    }

  if (openErr) return { error: openErr.message }

  const unscoredCount = (openAnswers ?? []).filter(
    a => a.quiz_questions.kind === 'open' && a.score === null
  ).length

  if (unscoredCount > 0) {
    return {
      error: `${unscoredCount} open question${unscoredCount !== 1 ? 's' : ''} still need scoring before publishing.`,
      unscoredCount,
    }
  }

  const { error } = await db
    .from('quiz_assignments')
    .update({
      status:           'published',
      published_at:     new Date().toISOString(),
      reviewed_by:      caller.id,
      overall_feedback: overallFeedback?.trim() || null,
    })
    .eq('id', assignmentId)

  if (error) return { error: error.message }
  return { error: null }
}
