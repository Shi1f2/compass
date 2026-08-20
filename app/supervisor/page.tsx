/**
 * app/supervisor/page.tsx
 * Supervisor console — loads real roster, task counts, and profile from Supabase.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile, Organization, Invitation, Task } from '@/lib/database.types'
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

  // Load task counts for all supervisees in one query.
  // We only need profile_id and status — not the full task rows.
  const internIds = (interns ?? []).map(i => i.id)
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
      invitations={invitations ?? []}
    />
  )
}
