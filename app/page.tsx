/**
 * app/page.tsx
 * Root route — redirect based on session.
 * If signed in, go to the role-appropriate console.
 * If not, go to /login.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = user.app_metadata?.role as string | undefined
  if (role === 'supervisor') {
    redirect('/supervisor')
  } else {
    redirect('/console')
  }
}
