/**
 * app/supervisor/SupervisorClient.tsx
 * Client wrapper for the supervisor console.
 * Wires real DB data (roster, task counts, org) into ConsoleShell.
 */
'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { deepCopyProfile, nameInitials } from '@/lib/data'
import {
  DEMO_CONTENT_ENABLED,
  getDemoProfile,
  buildBareProfile,
} from '@/lib/demo-content'
import ConsoleShell from '@/components/console/ConsoleShell'
import { signOut } from '@/lib/auth-actions'
import { inviteIntern } from '@/lib/invite-action'
import type { Starter } from '@/lib/supervisorData'

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
  invitations:     { id: string; email: string; role: string; status: string; created_at: string }[]
}

// ─── Map a DB profile row to a Starter ───────────────────────────────────────

function internToStarter(
  intern: InternRow,
  counts: { done: number; total: number },
): Starter {
  return {
    id:        intern.id,
    name:      intern.full_name,
    initials:  nameInitials(intern.full_name),
    jobTitle:  intern.job_title  ?? null,
    team:      intern.team       ?? null,
    startDate: intern.start_date ?? null,
    taskDone:  counts.done,
    taskTotal: counts.total,
    quiz:      [],
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SupervisorClient({
  supervisorName,
  supervisorEmail,
  orgId,
  orgName,
  interns,
  taskCounts,
}: SupervisorClientProps) {
  const router = useRouter()

  const demoBase = getDemoProfile(supervisorName, orgName)
  const profile = demoBase
    ? deepCopyProfile(demoBase)
    : buildBareProfile(supervisorName, orgName)
  profile.persona.role = 'supervisor'
  profile.systemsMeta.workspaceName = orgName

  const roster: Starter[] = interns.map(intern =>
    internToStarter(intern, taskCounts[intern.id] ?? { done: 0, total: 0 }),
  )

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

  return (
    <ConsoleShell
      profile={profile}
      role="supervisor"
      company={orgName}
      onSignOut={handleSignOut}
      roster={roster}
      onInvite={handleInvite}
      email={supervisorEmail}
      internCount={roster.length}
      orgId={orgId}
      demoContent={DEMO_CONTENT_ENABLED}
    />
  )
}
