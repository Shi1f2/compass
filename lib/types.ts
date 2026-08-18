/**
 * lib/types.ts
 * Single source of truth for every data shape in the app.
 * Type declarations only — no runtime code.
 */

// ─── Role ─────────────────────────────────────────────────────────────────────

/**
 * Chosen at sign-in from a checkbox and held in memory for the session only;
 * never persisted, never validated against anything.
 */
export type Role = 'supervisor' | 'new-starter'

// ─── Note ─────────────────────────────────────────────────────────────────────

export type NoteKind = 'none' | 'tip' | 'warning'

export interface Note {
  kind: NoteKind
  text: string
}

// ─── Highlight ────────────────────────────────────────────────────────────────

/**
 * A rectangle over an illustration given as four numbers between 0 and 1
 * (x, y, width, height) plus an optional short label.
 * The coordinates are normalised so the same rectangle works at thumbnail,
 * console and print sizes with no recalculation. The label is a short
 * machine-ish caption drawn on the box corner.
 */
export interface Highlight {
  x: number
  y: number
  width: number
  height: number
  label?: string
}

// ─── Source system ────────────────────────────────────────────────────────────

export type SourceSystem =
  | 'HRIS'
  | 'ITSM'
  | 'Docs'
  | 'Comms'
  | 'Project'
  | 'Expenses'
  | 'SSO'

// ─── Compass view ─────────────────────────────────────────────────────────────

export type CompassView =
  | 'portal-home'    // The Compass panel embedded in a generic intranet
  | 'hris-record'    // An employee record
  | 'itsm-ticket'    // A service-desk ticket: laptop setup, VPN and access requests
  | 'docs-article'   // A policy or wiki excerpt
  | 'comms-thread'   // A chat thread with Compass answering inline
  | 'project-board'  // Kanban and team tooling
  | 'expense-claim'  // An expense submission form
  | 'quiz'           // A Tutor question and result card

// ─── Scene ────────────────────────────────────────────────────────────────────

/**
 * The spec that drives one illustration. Every illustration in the app is an
 * inline SVG driven by one of these specs and rendered by a single component
 * with many views — no bitmaps and no network, so the demo runs fully offline.
 */
export interface Scene {
  view: CompassView
  /** Index of the highlighted sidebar entry */
  sidebarIndex: number
  /** Index of the highlighted table or list row; -1 means none */
  rowIndex: number
  /** Optional overlay type */
  overlay?: 'modal' | 'toast' | 'tooltip' | null
  /** Optional cursor position in viewBox units */
  cursor?: [number, number]
  /** Optional small vertical content offset that differentiates otherwise identical frames */
  scrollOffset?: number
  /** Optional text typed into a field */
  typedText?: string
  /** Index of which form field has focus; -1 means none */
  focusedField?: number
}

// ─── Persona ──────────────────────────────────────────────────────────────────

export type OperatingSystem = 'macOS' | 'Windows'
export type SecurityTier = 'Standard' | 'Restricted'

export interface Persona {
  id: string
  name: string
  role: Role
  employmentType: string
  team: string
  os: OperatingSystem
  location: string
  startDate: string
  manager: string
  securityTier: SecurityTier
  /** Initials displayed on the avatar */
  initials: string
}

// ─── Topic ────────────────────────────────────────────────────────────────────

/** One question-and-answer pair in the Mentor tab */
export interface Topic {
  id: string
  /** Phrased as the persona's own question, e.g. "How do I get my laptop set up?" */
  title: string
  answer: string
  /** A second hardcoded wording, swapped in by the regenerate action */
  altAnswer: string
  /** Expanded description for the report's detail column: where this actually lives */
  detail: string
  /** Day offset into the onboarding programme where this topic starts */
  start: number
  /** Day offset into the onboarding programme where this topic ends */
  end: number
  system: SourceSystem
  highlight?: Highlight
  scene?: Scene
  note?: Note
  /** Optional, hand-authored: how this same answer differs for the other persona */
  scopedNote?: string
  /** Static gamification seed */
  points: number
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────

export interface QuizOption {
  id: string
  text: string
}

/**
 * Entirely static and fake, per the demo's no-backend rule.
 * There is no scoring logic anywhere in this app.
 */
export interface QuizResult {
  chosenOptionId: string
  correct: boolean
  score: number
  attemptedAt: string
  passThreshold: number
  acknowledgement: string
}

/**
 * 'choice' (the default when omitted) is a multiple-choice question.
 * 'written' is an open-response question graded on a 0–100 scale instead of
 * right or wrong; its options and correct-option fields go unused and are left
 * empty.
 */
export type QuestionKind = 'choice' | 'written'

export interface Question {
  id: string
  /** Optional; defaults to 'choice' when omitted */
  kind?: QuestionKind
  /** Day topic label shared by every question grouped under the same start day */
  dayLabel: string
  prompt: string
  system: SourceSystem
  options: QuizOption[]
  correctOptionId: string
  explanation: string
  altExplanation: string
  highlight?: Highlight
  scene?: Scene
  start: number
  end: number
  points: number
  note?: Note
  result?: QuizResult
  /* Written-question fields — unused for choice questions */
  /** The answer the person actually gave */
  writtenAnswer?: string
  /** The answer that would have earned full marks */
  modelAnswer?: string
  /** One short line naming what was left out */
  missedPoint?: string
}

// ─── Systems metadata ─────────────────────────────────────────────────────────

/**
 * Drives the processing screen's fake connection sequence.
 */
export interface SystemsMeta {
  workspaceName: string
  connectedSystems: number
  recordCount: number
  connectionType: string
  lastSynced: string
}

// ─── Spec item ────────────────────────────────────────────────────────────────

/** One row of the printed report's specification strip */
export interface SpecItem {
  label: string
  value: string
}

// ─── Profile ──────────────────────────────────────────────────────────────────

/** The whole thing: a persona plus all their onboarding content */
export interface Profile {
  persona: Persona
  /** Printed as the console and report heading */
  title: string
  subtitle: string
  /** Total length of the onboarding programme in days — the phase strip's total */
  programmeDays: number
  connectedSystems: SourceSystem[]
  /** General cautions for the report's policy panel */
  usageNotes: string[]
  specRows: SpecItem[]
  topics: Topic[]
  quiz: Question[]
  /** Hardcoded percentage of onboarding completed. Nothing computes this. */
  onboardingPct: number
  systemsMeta: SystemsMeta
}
