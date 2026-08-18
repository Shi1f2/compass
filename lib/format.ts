/**
 * lib/format.ts
 * Pure formatting helpers shared by the console and the exported report.
 */

import type { NoteKind } from './types'

// ─── Day label ────────────────────────────────────────────────────────────────

/**
 * Converts a zero-indexed day offset to a one-indexed display label.
 * Day 0 → "Day 1", Day 11 → "Day 12". Negative values clamp to zero.
 */
export function dayLabel(offset: number): string {
  return `Day ${Math.round(Math.max(0, offset)) + 1}`
}

// ─── Phase label ──────────────────────────────────────────────────────────────

/** Buckets a day offset into one of the four programme phases. */
export function phaseLabel(offset: number): string {
  if (offset <= 1)  return 'Day 1'
  if (offset <= 7)  return 'Week 1'
  if (offset <= 30) return 'Month 1'
  return 'Ongoing'
}

// ─── Shared UI strings ────────────────────────────────────────────────────────

/** Strings shared between the console and the exported report. */
export const UI = Object.freeze({
  tip:              'Tip',
  warning:          'Warning',
  page:             'Page',
  reportManager:    'Manager summary',
  reportCompliance: 'Compliance evidence pack',
  footer:           'Prepared with Compass',
} as const)

// ─── Note kind → label ────────────────────────────────────────────────────────

/** Returns the display label for a note kind. */
export function noteKindLabel(kind: NoteKind): string {
  if (kind === 'tip')     return UI.tip
  if (kind === 'warning') return UI.warning
  return ''
}
