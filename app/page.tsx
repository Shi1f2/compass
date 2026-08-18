/**
 * app/page.tsx
 * Root page — the app's entire phase machine.
 * Three phases: login → processing → console.
 */
'use client'

import { useCallback, useState } from 'react'
import type { Profile, Role } from '@/lib/types'
import { deepCopyProfile } from '@/lib/data'
import LoginScreen      from '@/components/LoginScreen'
import ProcessingScreen from '@/components/ProcessingScreen'
import ConsoleShell     from '@/components/console/ConsoleShell'

// ─── Phase type ───────────────────────────────────────────────────────────────

type Phase = 'login' | 'processing' | 'console'

// ─── Root page ────────────────────────────────────────────────────────────────

export default function RootPage() {
  const [phase,   setPhase]   = useState<Phase>('login')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [role,    setRole]    = useState<Role>('new-starter')
  const [company, setCompany] = useState<string>('')

  const handleStart = useCallback((p: Profile, r: Role, c: string) => {
    // Store a deep copy so the console can mutate freely without touching seed data
    setProfile(deepCopyProfile(p))
    setRole(r)
    setCompany(c)
    setPhase('processing')
  }, [])

  const handleDone = useCallback(() => {
    setPhase('console')
  }, [])

  const handleSignOut = useCallback(() => {
    setProfile(null)
    setRole('new-starter')
    setCompany('')
    setPhase('login')
  }, [])

  if (phase === 'login' || !profile) {
    return <LoginScreen onStart={handleStart} />
  }

  if (phase === 'processing') {
    return <ProcessingScreen profile={profile} onDone={handleDone} />
  }

  return (
    <ConsoleShell
      profile={profile}
      role={role}
      company={company}
      onSignOut={handleSignOut}
    />
  )
}
