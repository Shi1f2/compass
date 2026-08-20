/**
 * app/login/page.tsx
 * Login page. If already signed in, redirect immediately.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginScreen from '@/components/LoginScreen'

export default async function LoginPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const role = user.app_metadata?.role as string | undefined
    redirect(role === 'supervisor' ? '/supervisor' : '/console')
  }

  return <LoginScreen />
}
