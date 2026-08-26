/**
 * app/console/ConsoleClient.tsx
 * Thin client wrapper: builds the Profile from real identity data,
 * then mounts ConsoleShell.
 *
 * ProcessingScreen is shown on the first sign-in of each browser session.
 * A sessionStorage flag (keyed to the user's id) prevents it from re-appearing
 * on tab switches or client-side navigations within the same session.
 *
 * Hydration-safe design
 * ─────────────────────
 * sessionStorage is only readable in the browser, never on the server.
 * useState's lazy initialiser runs during SSR, so calling sessionStorage there
 * produces a mismatch between server HTML (saw `catch → true → show shell`) and
 * the first client paint (saw the real flag). React throws "Hydration failed".
 *
 * The fix: initial state is always `null` ("not yet checked") on both sides.
 * A useEffect (client-only, never SSR) reads sessionStorage immediately after
 * mount and sets ready to true (skip) or false (show).  Until that effect
 * runs the component renders nothing, which matches the server's output exactly.
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DEMO_CONTENT_ENABLED,
  getDemoProfile,
  buildBareProfile,
} from '@/lib/demo-content'
import { deepCopyProfile } from '@/lib/data'
import { createClient } from '@/lib/supabase/client'
import ConsoleShell from '@/components/console/ConsoleShell'
import ProcessingScreen, { type ProcessingStep } from '@/components/ProcessingScreen'
import { signOut } from '@/lib/auth-actions'

// ─── Session key ──────────────────────────────────────────────────────────────

function sessionKey(userId: string) {
  return `compass:processing-shown:${userId}`
}

function hasSeenProcessing(userId: string): boolean {
  try {
    return sessionStorage.getItem(sessionKey(userId)) === '1'
  } catch {
    return true  // storage unavailable — skip the screen
  }
}

function markProcessingSeen(userId: string): void {
  try {
    sessionStorage.setItem(sessionKey(userId), '1')
  } catch {
    // ignore
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConsoleClientProps {
  userId:   string
  fullName: string
  orgName:  string
  orgId:    string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConsoleClient({ userId, fullName, orgName, orgId }: ConsoleClientProps) {
  const router = useRouter()

  const [profile] = useState(() => {
    const demo = getDemoProfile(fullName, orgName)
    return demo
      ? deepCopyProfile(demo)
      : buildBareProfile(fullName, orgName)
  })

  // null  = not yet checked (renders nothing — matches server output)
  // false = show the processing screen
  // true  = skip straight to the shell
  const [ready, setReady] = useState<boolean | null>(null)

  // Steps are created alongside the ready=false decision so they are never
  // allocated when the user has already seen the screen this session.
  const [steps, setSteps] = useState<ProcessingStep[]>([])

  // Read sessionStorage after mount — never during SSR.
  // This is the only place that touches browser-only APIs.
  useEffect(() => {
    if (hasSeenProcessing(userId)) {
      setReady(true)
      return
    }

    // First visit of this session: build the real-work promises and show
    // the screen.  These are the three fetches that happen when the console
    // loads anyway — making them visible here costs nothing extra.
    const supabase = createClient()

    const profileWork: Promise<void> = Promise.resolve(
      supabase
        .from('profiles')
        .select('id, full_name, job_title')
        .eq('id', userId)
        .maybeSingle(),
    ).then(() => undefined)

    const tasksWork: Promise<void> = Promise.resolve(
      supabase
        .from('tasks')
        .select('id, status')
        .eq('profile_id', userId),
    ).then(() => undefined)

    const quizzesWork: Promise<void> = Promise.resolve(
      supabase
        .from('quiz_assignments')
        .select('id, status')
        .eq('profile_id', userId),
    ).then(() => undefined)

    setSteps([
      { label: 'Loading your profile', work: profileWork  },
      { label: 'Loading your tasks',   work: tasksWork    },
      { label: 'Loading your quizzes', work: quizzesWork  },
    ])
    setReady(false)
  // userId is stable — props never change for the life of this instance
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDone = useCallback(() => {
    markProcessingSeen(userId)
    setReady(true)
  }, [userId])

  const handleSignOut = useCallback(async () => {
    await signOut()
    router.push('/login')
  }, [router])

  const firstName = fullName.split(' ')[0] ?? fullName

  // null: still waiting for the useEffect — render nothing so the server and
  // first-client-paint trees are identical (both empty / same content).
  if (ready === null) return null

  if (ready === false) {
    return (
      <ProcessingScreen
        firstName={firstName}
        steps={steps}
        onDone={handleDone}
      />
    )
  }

  return (
    <ConsoleShell
      profile={profile}
      role="new-starter"
      company={orgName}
      userId={userId}
      orgId={orgId}
      onSignOut={handleSignOut}
      demoContent={DEMO_CONTENT_ENABLED}
    />
  )
}
