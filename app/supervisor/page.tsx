/**
 * app/supervisor/page.tsx
 * Supervisor console — loads real roster, task counts, quiz counts and profile from Supabase.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile, Organization, Invitation, Task } from '@/lib/database.types'
import type { QuizCounts } from '@/lib/supervisorData'
import SupervisorClient from './SupervisorClient'

export default async function SupervisorPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load the supervisor's own profile
  const { data: selfProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single() as { data: Profile | null; error: unknown }

  if (!selfProfile) redirect('/login')

  const self = selfProfile as Profile

  // Load org name
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', self.org_id)
    .single() as { data: Organization | null; error: unknown }

  // Load interns assigned to this supervisor
  const { data: interns } = await supabase
    .from('profiles')
    .select('*')
    .eq('supervisor_id', self.id)
    .eq('role', 'intern')
    .order('created_at', { ascending: true }) as { data: Profile[] | null; error: unknown }

  const internIds = (interns ?? []).map(i => i.id)

  // ── Task counts — one batched query for all supervisees ───────────────────────
  let taskRows: Pick<Task, 'profile_id' | 'status'>[] = []
  if (internIds.length > 0) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('profile_id, status')
      .in('profile_id', internIds) as { data: Pick<Task, 'profile_id' | 'status'>[] | null; error: unknown }
    taskRows = tasks ?? []
  }

  // Build a map: profileId → { done, total }
  const taskCounts: Record<string, { done: number; total: number }> = {}
  for (const row of taskRows) {
    if (!taskCounts[row.profile_id]) taskCounts[row.profile_id] = { done: 0, total: 0 }
    taskCounts[row.profile_id]!.total++
    if (row.status === 'done') taskCounts[row.profile_id]!.done++
  }

  // ── Quiz counts — one batched query for all supervisees ───────────────────────
  // We pull profile_id, status, and the per-answer scores so we can compute
  // avgScore for finished (published) assignments without a second query.
  type QuizAssignmentRow = {
    profile_id: string
    status:     string
    quiz_answers: { score: number | null }[]
  }
  let quizRows: QuizAssignmentRow[] = []
  if (internIds.length > 0) {
    const { data: qa } = await supabase
      .from('quiz_assignments')
      .select('profile_id, status, quiz_answers(score)')
      .in('profile_id', internIds) as { data: QuizAssignmentRow[] | null; error: unknown }
    quizRows = qa ?? []
  }

  // Build a map: profileId → QuizCounts
  // scoreSum / scoreCount track a running total so avgScore divides only by
  // assignments that actually contributed at least one scored answer.
  const quizCounts: Record<string, QuizCounts> = {}
  const scoreAcc:   Record<string, { sum: number; count: number }> = {}
  for (const row of quizRows) {
    if (!quizCounts[row.profile_id]) {
      quizCounts[row.profile_id] = { total: 0, untouched: 0, inProgress: 0, finished: 0, avgScore: null }
      scoreAcc[row.profile_id]   = { sum: 0, count: 0 }
    }
    const c = quizCounts[row.profile_id]!
    c.total++
    if (row.status === 'assigned') {
      c.untouched++
    } else if (row.status === 'in_progress' || row.status === 'submitted') {
      c.inProgress++
    } else if (row.status === 'published') {
      c.finished++
      const scores = row.quiz_answers.map(a => a.score).filter((s): s is number => s !== null)
      if (scores.length > 0) {
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length
        scoreAcc[row.profile_id]!.sum   += mean
        scoreAcc[row.profile_id]!.count += 1
      }
    }
  }
  for (const id of Object.keys(quizCounts)) {
    const acc = scoreAcc[id]!
    if (acc.count > 0) {
      quizCounts[id]!.avgScore = Math.round(acc.sum / acc.count)
    }
  }

  // Load pending invitations sent by this supervisor
  const { data: invitations } = await supabase
    .from('invitations')
    .select('*')
    .eq('invited_by', self.id)
    .order('created_at', { ascending: false }) as { data: Invitation[] | null; error: unknown }

  return (
    <SupervisorClient
      supervisorId={self.id}
      supervisorName={self.full_name}
      supervisorEmail={user!.email ?? ''}
      orgId={self.org_id}
      orgName={org?.name ?? ''}
      interns={interns ?? []}
      taskCounts={taskCounts}
      quizCounts={quizCounts}
      invitations={invitations ?? []}
    />
  )
}
