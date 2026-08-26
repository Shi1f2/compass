/**
 * app/console/page.tsx
 * Intern console — loads the real profile from Supabase,
 * then mounts the existing ConsoleShell with real identity data.
 * Content (topics, quiz) comes from the personalised template until
 * the knowledge backend is wired by the other developer.
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

  // Load the organization for the company name
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', (profile as Profile).org_id)
    .single() as { data: Organization | null; error: unknown }

  return (
    <ConsoleClient
      userId={user!.id}
      fullName={(profile as Profile).full_name}
      orgName={org?.name ?? ''}
      orgId={(profile as Profile).org_id}
    />
  )
}
