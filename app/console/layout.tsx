/**
 * app/console/layout.tsx
 * Route guard for the intern console.
 * Redirects to /login if unauthenticated, to /supervisor if the user is a supervisor.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = user.app_metadata?.role as string | undefined
  if (role === 'supervisor') redirect('/supervisor')

  return <>{children}</>
}
