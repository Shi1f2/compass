/**
 * app/supervisor/SupervisorClient.tsx
 * Client wrapper for the supervisor console.
 * Wires real DB data (roster, task counts, org) into ConsoleShell.
 *
 * ProcessingScreen is shown on the first sign-in of each browser session.
 * A sessionStorage flag (keyed to the supervisor's id) prevents it from
 * re-appearing on tab switches or client-side navigations within the same
 * session.
 *
 * Hydration-safe design
 * ─────────────────────
 * See ConsoleClient.tsx for the full explanation. TL;DR: initial state is
 * `null` on both server and client; useEffect (client-only) reads sessionStorage
 * and transitions to false (show) or true (skip).
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { deepCopyProfile, nameInitials } from '@/lib/data'
import {
  DEMO_CONTENT_ENABLED,
  getDemoProfile,
  buildBareProfile,
} from '@/lib/demo-content'
import { createClient } from '@/lib/supabase/client'
import ConsoleShell from '@/components/console/ConsoleShell'
import ProcessingScreen, { type ProcessingStep } from '@/components/ProcessingScreen'
import { signOut } from '@/lib/auth-actions'
import { inviteIntern } from '@/lib/invite-action'
import type { Starter, QuizCounts } from '@/lib/supervisorData'

// ─── Session key ──────────────────────────────────────────────────────────────

function sessionKey(userId: string) {
  return `compass:processing-shown:${userId}`
}

function hasSeenProcessing(userId: string): boolean {
  try {
    return sessionStorage.getItem(sessionKey(userId)) === '1'
  } catch {
    return true  // if storage is unavailable, skip the screen
  }
}

function markProcessingSeen(userId: string): void {
  try {
    sessionStorage.setItem(sessionKey(userId), '1')
  } catch {
    // ignore
  }
}

// ─── Types from the server page ───────────────────────────────────────────────

interface InternRow {
  id:          string
  full_name:   string
  job_title:   string | null
  team:        string | null
  start_date:  string | null
  created_at:  string
}

interface SupervisorClientProps {
  supervisorId:    string
  supervisorName:  string
  supervisorEmail: string
  orgId:           string
  orgName:         string
  interns:         InternRow[]
  taskCounts:      Record<string, { done: number; total: number }>
  quizCounts:      Record<string, QuizCounts>
  invitations:     { id: string; email: string; role: string; status: string; created_at: string }[]
}

const EMPTY_QUIZ_COUNTS: QuizCounts = {
  total: 0, untouched: 0, inProgress: 0, finished: 0, avgScore: null,
}

// ─── Map a DB profile row to a Starter ───────────────────────────────────────

function internToStarter(
  intern:    InternRow,
  tasks:     { done: number; total: number },
  quizzes:   QuizCounts,
): Starter {
  return {
    id:         intern.id,
    name:       intern.full_name,
    initials:   nameInitials(intern.full_name),
    jobTitle:   intern.job_title  ?? null,
    team:       intern.team       ?? null,
    startDate:  intern.start_date ?? null,
    taskDone:   tasks.done,
    taskTotal:  tasks.total,
    quizCounts: quizzes,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SupervisorClient({
  supervisorId,
  supervisorName,
  supervisorEmail,
  orgId,
  orgName,
  interns,
  taskCounts,
  quizCounts,
}: SupervisorClientProps) {
  const router = useRouter()

  const demoBase = getDemoProfile(supervisorName, orgName)
  const profile = demoBase
    ? deepCopyProfile(demoBase)
    : buildBareProfile(supervisorName, orgName)
  profile.persona.role = 'supervisor'
  profile.systemsMeta.workspaceName = orgName

  const roster: Starter[] = interns.map(intern =>
    internToStarter(
      intern,
      taskCounts[intern.id] ?? { done: 0, total: 0 },
      quizCounts[intern.id] ?? EMPTY_QUIZ_COUNTS,
    ),
  )

  // null  = not yet checked (renders nothing — matches server output)
  // false = show the processing screen
  // true  = skip straight to the shell
  const [ready, setReady] = useState<boolean | null>(null)

  // Steps are created alongside the ready=false decision so they are never
  // allocated when the user has already seen the screen this session.
  const [steps, setSteps] = useState<ProcessingStep[]>([])

  // Read sessionStorage after mount — never during SSR.
  useEffect(() => {
    if (hasSeenProcessing(supervisorId)) {
      setReady(true)
      return
    }

    // First visit of this session: lightweight reads that will happen when the
    // console mounts anyway — making them visible here costs nothing extra.
    const supabase = createClient()

    const rosterWork: Promise<void> = Promise.resolve(
      supabase
        .from('profiles')
        .select('id')
        .eq('supervisor_id', supervisorId)
        .eq('role', 'intern'),
    ).then(() => undefined)

    const quizzesWork: Promise<void> = Promise.resolve(
      supabase
        .from('quizzes')
        .select('id')
        .eq('org_id', orgId),
    ).then(() => undefined)

    setSteps([
      { label: 'Loading your roster',  work: rosterWork  },
      { label: 'Loading your quizzes', work: quizzesWork },
    ])
    setReady(false)
  // supervisorId and orgId are stable — props never change for the life of this instance
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDone = useCallback(() => {
    markProcessingSeen(supervisorId)
    setReady(true)
  }, [supervisorId])

  const handleSignOut = useCallback(async () => {
    await signOut()
    router.push('/login')
  }, [router])

  const handleInvite = useCallback(async (
    email:     string,
    jobRoleId: string,
  ): Promise<string | null> => {
    return inviteIntern(email, jobRoleId)
  }, [])

  const firstName = supervisorName.split(' ')[0] ?? supervisorName

  // null: still waiting for useEffect — render nothing to match server output.
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
      role="supervisor"
      company={orgName}
      userId={supervisorId}
      orgId={orgId}
      onSignOut={handleSignOut}
      roster={roster}
      onInvite={handleInvite}
      email={supervisorEmail}
      internCount={roster.length}
      demoContent={DEMO_CONTENT_ENABLED}
    />
  )
}
