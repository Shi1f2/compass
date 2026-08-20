/**
 * app/console/ConsoleClient.tsx
 * Thin client wrapper: builds the Profile from real identity data,
 * then mounts ConsoleShell.
 *
 * When NEXT_PUBLIC_DEMO_CONTENT=true the personalised sample profile is used
 * and a "Sample content" badge is shown in the shell header.
 * When the flag is off the shell receives an empty-content bare profile.
 */
'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DEMO_CONTENT_ENABLED,
  getDemoProfile,
  buildBareProfile,
} from '@/lib/demo-content'
import { deepCopyProfile } from '@/lib/data'
import ConsoleShell from '@/components/console/ConsoleShell'
import ProcessingScreen from '@/components/ProcessingScreen'
import { signOut } from '@/lib/auth-actions'

interface ConsoleClientProps {
  userId:   string
  fullName: string
  orgName:  string
}

export default function ConsoleClient({ fullName, orgName }: ConsoleClientProps) {
  const router = useRouter()

  const [profile] = useState(() => {
    const demo = getDemoProfile(fullName, orgName)
    return demo
      ? deepCopyProfile(demo)
      : buildBareProfile(fullName, orgName)
  })

  // The processing screen is only shown in demo mode — it advertises fake
  // system connections that do not exist in real accounts.
  const [ready, setReady] = useState(!DEMO_CONTENT_ENABLED)

  const handleDone = useCallback(() => setReady(true), [])

  const handleSignOut = useCallback(async () => {
    await signOut()
    router.push('/login')
  }, [router])

  if (!ready) {
    return <ProcessingScreen profile={profile} onDone={handleDone} />
  }

  return (
    <ConsoleShell
      profile={profile}
      role="new-starter"
      company={orgName}
      onSignOut={handleSignOut}
      demoContent={DEMO_CONTENT_ENABLED}
    />
  )
}
