/**
 * lib/supervisorData.ts
 * Types and helpers for the supervisor roster.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const PASS_THRESHOLD = 80

// ─── Roster model ─────────────────────────────────────────────────────────────

/**
 * Quiz progress totals for one intern.
 * "finished" means the assignment is published (auto-graded and visible).
 */
export interface QuizCounts {
  total:      number
  untouched:  number   // assigned, never opened
  inProgress: number   // opened but not yet submitted
  finished:   number   // published (auto-graded)
  avgScore:   number | null  // mean score across finished assignments, null when none finished
}

export interface Starter {
  id:        string
  name:      string
  initials:  string
  jobTitle:  string | null
  team:      string | null
  startDate: string | null
  taskDone:  number
  taskTotal: number
  quizCounts: QuizCounts
}

// ─── Derived stats ────────────────────────────────────────────────────────────

/** Number of finished quiz assignments. */
export function answeredCount(s: Starter): number {
  return s.quizCounts.finished
}

/** Average score across finished assignments, or null when none are finished. */
export function averageScore(s: Starter): number | null {
  return s.quizCounts.avgScore
}

/** Task completion percentage (0–100). 0 when there are no tasks. */
export function taskPct(s: Starter): number {
  return s.taskTotal > 0 ? Math.round((s.taskDone / s.taskTotal) * 100) : 0
}

/** Quiz completion percentage (0–100). 0 when there are no quizzes. */
export function quizPct(s: Starter): number {
  const { total, finished } = s.quizCounts
  return total > 0 ? Math.round((finished / total) * 100) : 0
}

/**
 * Combined onboarding progress percentage (0–100).
 * Numerator:   completed tasks + finished quizzes
 * Denominator: total tasks + total quizzes
 * Returns 0 when the person has neither tasks nor quizzes.
 */
export function overallPct(s: Starter): number {
  const denom = s.taskTotal + s.quizCounts.total
  if (denom === 0) return 0
  const numer = s.taskDone + s.quizCounts.finished
  return Math.round((numer / denom) * 100)
}

/** @deprecated Use overallPct for the progress bar; quizPct for the knowledge bar. */
export function knowledgePct(s: Starter): number {
  return quizPct(s)
}
