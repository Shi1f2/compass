/**
 * lib/demo-content.ts
 * Sample content for demonstration purposes — illustrative only.
 *
 * All profile data in this file is invented. It is never used in production
 * and must not be inserted into the database or shown to real users without
 * the NEXT_PUBLIC_DEMO_CONTENT flag.
 *
 * Usage:
 *   import { getDemoProfile, buildBareProfile } from '@/lib/demo-content'
 *
 *   const profile = getDemoProfile(fullName, orgName) ?? buildBareProfile(fullName, orgName)
 *
 * - getDemoProfile returns a personalised copy of the sample profile when
 *   NEXT_PUBLIC_DEMO_CONTENT=true, otherwise returns null.
 * - buildBareProfile returns a minimal, empty-content profile that is safe
 *   to use with real user identities regardless of the flag.
 */

import {
  PRIYA_PROFILE,
  deepCopyProfile,
  personalise,
  nameInitials,
} from './data'
import type { Profile } from './types'

// ─── Flag ─────────────────────────────────────────────────────────────────────

export const DEMO_CONTENT_ENABLED =
  process.env.NEXT_PUBLIC_DEMO_CONTENT === 'true'

// ─── Personalised sample profile (flag-gated) ────────────────────────────────

/**
 * Returns a deep-copied, personalised sample profile when demo content is
 * enabled, otherwise returns null.
 *
 * The caller is responsible for checking the return value and falling back to
 * buildBareProfile when null is returned.
 */
export function getDemoProfile(
  fullName: string,
  orgName:  string,
): Profile | null {
  if (!DEMO_CONTENT_ENABLED) return null
  return deepCopyProfile(personalise(PRIYA_PROFILE, fullName, orgName))
}

// ─── Minimal bare profile (always safe) ──────────────────────────────────────

/**
 * Builds the smallest valid Profile from real user identity data.
 * No invented content — topics, quiz, specRows are all empty arrays.
 * This is what interns and supervisors get when demo content is off.
 */
export function buildBareProfile(
  fullName: string,
  orgName:  string,
): Profile {
  return {
    persona: {
      id:             fullName.toLowerCase().replace(/\s+/g, '-'),
      name:           fullName,
      role:           'new-starter',
      employmentType: '',
      team:           '',
      os:             'macOS',
      location:       '',
      startDate:      '',
      manager:        '',
      securityTier:   'Standard',
      initials:       nameInitials(fullName),
    },
    title:            fullName,
    subtitle:         orgName,
    programmeDays:    90,
    connectedSystems: [],
    usageNotes:       [],
    specRows:         [],
    topics:           [],
    quiz:             [],
    onboardingPct:    0,
    systemsMeta: {
      workspaceName:    orgName,
      connectedSystems: 0,
      recordCount:      0,
      connectionType:   '',
      lastSynced:       '',
    },
  }
}
