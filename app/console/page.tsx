/**
 * app/console/page.tsx
 * Intern console — loads the real profile, task counts and quiz counts from
 * Supabase, then mounts the existing ConsoleShell with real identity data.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile, Organization } from '@/lib/database.types'
import ConsoleClient from './ConsoleClient'

export default async function ConsolePage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load the user's profile row
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single() as { data: Profile | null; error: unknown }

  if (!profile) redirect('/login')

  const uid = user!.id

  // Load the organization for the company name
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', (profile as Profile).org_id)
    .single() as { data: Organization | null; error: unknown }

  // ── Task counts ──────────────────────────────────────────────────────────────
  const { data: taskRows } = await supabase
    .from('tasks')
    .select('status')
    .eq('profile_id', uid) as { data: { status: string }[] | null; error: unknown }

  const taskDone  = (taskRows ?? []).filter(t => t.status === 'done').length
  const taskTotal = (taskRows ?? []).length

  // ── Quiz counts ──────────────────────────────────────────────────────────────
  const { data: quizRows } = await supabase
    .from('quiz_assignments')
    .select('status')
    .eq('profile_id', uid) as { data: { status: string }[] | null; error: unknown }

  const quizFinished = (quizRows ?? []).filter(q => q.status === 'published').length
  const quizTotal    = (quizRows ?? []).length

  // Combined progress: (tasks done + quizzes finished) / (tasks total + quizzes total)
  const denom = taskTotal + quizTotal
  const progressPct = denom > 0 ? Math.round(((taskDone + quizFinished) / denom) * 100) : 0

  return (
    <ConsoleClient
      userId={uid}
      fullName={(profile as Profile).full_name}
      orgName={org?.name ?? ''}
      orgId={(profile as Profile).org_id}
      progressPct={progressPct}
    />
  )
}
