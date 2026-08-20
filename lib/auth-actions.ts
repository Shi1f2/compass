/**
 * lib/auth-actions.ts
 * Server Actions for authentication.
 * All Supabase auth calls that mutate state live here.
 */
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ─── Send OTP ─────────────────────────────────────────────────────────────────

/**
 * Step 1: user submits their email.
 * Uses shouldCreateUser: false so only provisioned accounts receive a code.
 * Returns a generic message regardless of whether the address is registered.
 */
export async function sendOtp(email: string): Promise<{ error?: string }> {
  const supabase = createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
    },
  })

  // Never reveal whether the address exists.
  // Log server-side for observability but return a generic message.
  if (error) {
    console.error('[sendOtp]', error.message)
  }

  // Always succeed from the user's perspective.
  return {}
}

// ─── Verify OTP ───────────────────────────────────────────────────────────────

/**
 * Step 2: user submits the 6-digit code.
 * On success, sets the session cookie and redirects to the appropriate console.
 * On failure, returns a generic error message.
 */
export async function verifyOtp(
  email: string,
  token: string,
): Promise<{ error?: string }> {
  const supabase = createClient()

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error || !data.session) {
    return { error: 'That code is incorrect or has expired. Please try again.' }
  }

  const role = data.session.user.app_metadata?.role as string | undefined

  if (role === 'supervisor') {
    redirect('/supervisor')
  } else {
    redirect('/console')
  }
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
