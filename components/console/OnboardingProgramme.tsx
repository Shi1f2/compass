/**
 * components/console/OnboardingProgramme.tsx
 * Task-progress summary shown on the new starter's Profile page.
 * Renders the segmented bar only — the checklist lives in the Tasks tab.
 */
'use client'

import InternTasks from './InternTasks'

interface OnboardingProgrammeProps {
  /** Kept for API compatibility with ProfileView; not used since tasks are self-contained. */
  onAskMentor: (query: string) => void
}

export default function OnboardingProgramme(_props: OnboardingProgrammeProps) {
  return <InternTasks view="bar" />
}
