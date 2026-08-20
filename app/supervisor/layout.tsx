/**
 * app/supervisor/layout.tsx
 * Route guard for the supervisor console.
 * Redirects to /login if unauthenticated, to /console if the user is an intern.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SupervisorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = user.app_metadata?.role as string | undefined
  if (role !== 'supervisor') redirect('/console')

  return <>{children}</>
}
