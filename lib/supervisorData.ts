/**
 * lib/supervisorData.ts
 * Types and helpers for the supervisor roster.
 */

import type { Question } from './types'
import { NOT_ATTEMPTED } from './quizGroup'

// ─── Constants ────────────────────────────────────────────────────────────────

export const PASS_THRESHOLD = 80

// ─── Roster model ─────────────────────────────────────────────────────────────

export interface Starter {
  id:        string
  name:      string
  initials:  string
  jobTitle:  string | null
  team:      string | null
  startDate: string | null
  taskDone:  number
  taskTotal: number
  quiz:      Question[]
}

// ─── Derived stats ────────────────────────────────────────────────────────────

export function answeredCount(s: Starter): number {
  return s.quiz.filter(q => q.result && q.result.attemptedAt !== NOT_ATTEMPTED).length
}

export function averageScore(s: Starter): number | null {
  const scores = s.quiz
    .filter(q => q.result && q.result.attemptedAt !== NOT_ATTEMPTED)
    .map(q => q.result!.score)
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
}

/** Task completion percentage (0–100). 0 when there are no tasks. */
export function taskPct(s: Starter): number {
  return s.taskTotal > 0 ? Math.round((s.taskDone / s.taskTotal) * 100) : 0
}

export function knowledgePct(s: Starter): number {
  const attempted = answeredCount(s)
  return s.quiz.length ? Math.round((attempted / s.quiz.length) * 100) : 0
}
