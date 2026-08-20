/**
 * components/console/OnboardingProgramme.tsx
 * New starter's checklist view — renders their real onboarding tasks from the DB.
 * The hardcoded PROGRAMME constant and demo task data have been removed.
 */
'use client'

import InternTasks from './InternTasks'

interface OnboardingProgrammeProps {
  /** Kept for API compatibility with ProfileView; not used since tasks are self-contained. */
  onAskMentor: (query: string) => void
}

export default function OnboardingProgramme(_props: OnboardingProgrammeProps) {
  return <InternTasks />
}
