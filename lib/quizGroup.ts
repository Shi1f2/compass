/**
 * lib/quizGroup.ts
 * Derives quiz-day groupings from the flat question array.
 * The grouping is computed at render time rather than stored, so the reducer
 * and the PDF export both operate against a plain list of questions.
 */

import type { Question } from './types'

// ─── Sentinel ────────────────────────────────────────────────────────────────

/** Used throughout the app to mean "this question was never attempted". */
export const NOT_ATTEMPTED = '—'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizDay {
  day: number
  topicLabel: string
  questions: Question[]
  /**
   * True when every question in the day is still unattempted — the demo's way
   * of representing "not reached yet" without a separate progress model.
   */
  locked: boolean
}

// ─── Grouping ────────────────────────────────────────────────────────────────

/** Buckets questions by start day, preserving order within each day. */
export function groupByDay(questions: Question[]): QuizDay[] {
  const map = new Map<number, Question[]>()

  for (const q of questions) {
    const bucket = map.get(q.start)
    if (bucket) {
      bucket.push(q)
    } else {
      map.set(q.start, [q])
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([day, qs]) => ({
      day,
      topicLabel: qs[0].dayLabel,
      questions: qs,
      locked: qs.every(q => !q.result || q.result.attemptedAt === NOT_ATTEMPTED),
    }))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the first unattempted question in a day, falling back to the first
 * question when every question in the day is already complete.
 */
export function firstUnanswered(day: QuizDay): Question {
  const unattempted = day.questions.find(
    q => !q.result || q.result.attemptedAt === NOT_ATTEMPTED,
  )
  return unattempted ?? day.questions[0]
}

/** Returns the day's rounded mean score across attempted questions. */
export function dayMeanScore(day: QuizDay): number {
  const attempted = day.questions.filter(
    q => q.result && q.result.attemptedAt !== NOT_ATTEMPTED,
  )
  if (attempted.length === 0) return 0
  const total = attempted.reduce((sum, q) => sum + (q.result?.score ?? 0), 0)
  return Math.round(total / attempted.length)
}

/** Returns how many questions in the day have been attempted. */
export function attemptedCount(day: QuizDay): number {
  return day.questions.filter(
    q => q.result && q.result.attemptedAt !== NOT_ATTEMPTED,
  ).length
}
