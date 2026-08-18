/**
 * lib/consoleState.ts
 * Reducer and state type for the signed-in console.
 * Pure functions only — every case returns a new object and never mutates input.
 */

import type { Highlight, Profile, Question, Scene, Topic } from './types'
import { NOT_ATTEMPTED, firstUnanswered, groupByDay } from './quizGroup'

// ─── State ────────────────────────────────────────────────────────────────────

export interface ConsoleState {
  profile: Profile
  selectedTopicId: string
  selectedQuestionId: string
}

// ─── ID generator ─────────────────────────────────────────────────────────────

let _counter = 0
function newId(): string {
  return `t${Date.now().toString(36)}${(++_counter).toString(36)}`
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Discriminated union of all console actions.
 *
 * Design notes:
 * 1. Reorder and Add (bare item) only make sense for the flat Mentor topic
 *    list. The Tutor tab reorders and adds whole days instead, since a single
 *    quiz question is never a standalone unit.
 * 2. Merge and Split only make sense for a question-and-answer topic — there is
 *    no sane way to merge two quiz questions — so they stay their own action
 *    types rather than being forced into a fake generic shape.
 */
export type ConsoleAction =
  | { type: 'SELECT';           list: 'topics' | 'quiz'; id: string }
  | { type: 'PATCH';            list: 'topics' | 'quiz'; id: string; patch: Partial<Topic> | Partial<Question> }
  | { type: 'REORDER';          list: 'topics'; from: number; to: number }
  | { type: 'DELETE';           list: 'topics' | 'quiz'; id: string }
  | { type: 'ADD';              list: 'topics' }
  | { type: 'REGENERATE';       list: 'topics' | 'quiz'; id: string }
  | { type: 'MERGE_TOPICS';     index: number }
  | { type: 'SPLIT_TOPIC';      id: string }
  | { type: 'SELECT_DAY';       day: number }
  | { type: 'REORDER_DAYS';     from: number; to: number }
  | { type: 'ADD_DAY' }
  | { type: 'ADD_QUESTION';     day: number }

/**
 * The minimal action subset that TutorDayList and TutorQuestionView dispatch.
 * Both (a: ConsoleAction) => void and (a: KnowledgeAction) => void satisfy
 * (a: TutorDispatch) => void via contravariance — narrower input = wider handler.
 */
export type TutorDispatch =
  | { type: 'SELECT';        list: 'quiz'; id: string }
  | { type: 'PATCH';         list: 'quiz'; id: string; patch: Partial<Question> }
  | { type: 'REGENERATE';    list: 'quiz'; id: string }
  | { type: 'SELECT_DAY';    day: number }
  | { type: 'REORDER_DAYS';  from: number; to: number }
  | { type: 'ADD_DAY' }
  | { type: 'ADD_QUESTION';  day: number }

// ─── Rebuild helpers ──────────────────────────────────────────────────────────

function withTopics(
  state: ConsoleState,
  topics: Topic[],
  selectedTopicId?: string,
): ConsoleState {
  return {
    ...state,
    profile: { ...state.profile, topics },
    selectedTopicId: selectedTopicId !== undefined ? selectedTopicId : state.selectedTopicId,
  }
}

function withQuiz(
  state: ConsoleState,
  quiz: Question[],
  selectedQuestionId?: string,
): ConsoleState {
  return {
    ...state,
    profile: { ...state.profile, quiz },
    selectedQuestionId: selectedQuestionId !== undefined ? selectedQuestionId : state.selectedQuestionId,
  }
}

// ─── Default highlight ────────────────────────────────────────────────────────

const DEFAULT_HIGHLIGHT: Highlight = {
  x: 0.30,
  y: 0.34,
  width: 0.40,
  height: 0.20,
  label: 'region',
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

export function consoleReducer(state: ConsoleState, action: ConsoleAction): ConsoleState {
  const { profile } = state
  const { topics, quiz, programmeDays } = profile

  switch (action.type) {

    // ── Select ──────────────────────────────────────────────────────────────
    case 'SELECT': {
      if (action.list === 'topics') {
        return { ...state, selectedTopicId: action.id }
      }
      return { ...state, selectedQuestionId: action.id }
    }

    // ── Patch ───────────────────────────────────────────────────────────────
    case 'PATCH': {
      if (action.list === 'topics') {
        return withTopics(
          state,
          topics.map(t => t.id === action.id ? { ...t, ...action.patch } : t),
        )
      }
      return withQuiz(
        state,
        quiz.map(q => q.id === action.id ? { ...q, ...action.patch } : q),
      )
    }

    // ── Regenerate ──────────────────────────────────────────────────────────
    case 'REGENERATE': {
      if (action.list === 'topics') {
        return withTopics(
          state,
          topics.map(t =>
            t.id === action.id
              ? { ...t, answer: t.altAnswer, altAnswer: t.answer }
              : t,
          ),
        )
      }
      return withQuiz(
        state,
        quiz.map(q =>
          q.id === action.id
            ? { ...q, explanation: q.altExplanation, altExplanation: q.explanation }
            : q,
        ),
      )
    }

    // ── Reorder topics ──────────────────────────────────────────────────────
    case 'REORDER': {
      const { from, to } = action
      if (from === to || from < 0 || to < 0 || from >= topics.length || to >= topics.length) {
        return state
      }
      const next = [...topics]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return withTopics(state, next)
    }

    // ── Delete ──────────────────────────────────────────────────────────────
    case 'DELETE': {
      if (action.list === 'topics') {
        if (topics.length <= 1) return state
        const idx = topics.findIndex(t => t.id === action.id)
        const next = topics.filter(t => t.id !== action.id)
        let newSel = state.selectedTopicId
        if (state.selectedTopicId === action.id) {
          newSel = (next[idx] ?? next[next.length - 1]).id
        }
        return withTopics(state, next, newSel)
      }
      // quiz
      if (quiz.length <= 1) return state
      const idx = quiz.findIndex(q => q.id === action.id)
      const next = quiz.filter(q => q.id !== action.id)
      let newSel = state.selectedQuestionId
      if (state.selectedQuestionId === action.id) {
        newSel = (next[idx] ?? next[next.length - 1]).id
      }
      return withQuiz(state, next, newSel)
    }

    // ── Add topic ────────────────────────────────────────────────────────────
    case 'ADD': {
      const last = topics[topics.length - 1]
      const startDay = last ? Math.min(last.end, programmeDays) : 0
      const endDay   = Math.min(startDay + 3, programmeDays)
      const fresh: Topic = {
        id:        newId(),
        title:     'New question',
        answer:    '',
        altAnswer: '',
        detail:    '',
        start:     startDay,
        end:       endDay,
        system:    last?.system ?? 'HRIS',
        scene:     last?.scene,
        highlight: DEFAULT_HIGHLIGHT,
        note:      undefined,
        points:    5,
      }
      return withTopics(state, [...topics, fresh], fresh.id)
    }

    // ── Select day ──────────────────────────────────────────────────────────
    case 'SELECT_DAY': {
      const days = groupByDay(quiz)
      const day = days.find(d => d.day === action.day)
      if (!day || day.locked) return state
      const target = firstUnanswered(day)
      return { ...state, selectedQuestionId: target.id }
    }

    // ── Reorder days ────────────────────────────────────────────────────────
    case 'REORDER_DAYS': {
      const { from, to } = action
      const days = groupByDay(quiz)
      if (from === to || from < 0 || to < 0 || from >= days.length || to >= days.length) {
        return state
      }
      const dayBlocks = [...days]
      const [block] = dayBlocks.splice(from, 1)
      dayBlocks.splice(to, 0, block)
      const reordered = dayBlocks.flatMap(d => d.questions)
      return withQuiz(state, reordered)
    }

    // ── Add day ─────────────────────────────────────────────────────────────
    case 'ADD_DAY': {
      const days = groupByDay(quiz)
      const lastDay = days[days.length - 1]
      const newDay  = lastDay ? lastDay.day + 5 : 0
      const template = lastDay?.questions[0]
      const fallbackScene: Scene = { view: 'quiz', sidebarIndex: 6, rowIndex: -1 }
      const fresh: Question = {
        id:            newId(),
        kind:          'choice',
        dayLabel:      'New day',
        prompt:        'New question',
        system:        template?.system ?? 'Docs',
        options:       [
          { id: newId(), text: 'Option A' },
          { id: newId(), text: 'Option B' },
        ],
        correctOptionId: '',
        explanation:     '',
        altExplanation:  '',
        highlight:       DEFAULT_HIGHLIGHT,
        scene:           template?.scene ?? fallbackScene,
        start:           newDay,
        end:             newDay + 1,
        points:          5,
        note:            undefined,
        result: {
          chosenOptionId:  '',
          correct:         false,
          score:           0,
          attemptedAt:     NOT_ATTEMPTED,
          passThreshold:   80,
          acknowledgement: '',
        },
      }
      // Set correctOptionId to first option
      fresh.correctOptionId = fresh.options[0]?.id ?? ''
      return withQuiz(state, [...quiz, fresh], fresh.id)
    }

    // ── Add question to day ──────────────────────────────────────────────────
    case 'ADD_QUESTION': {
      const template = quiz.find(q => q.start === action.day)
      if (!template) return state
      const fresh: Question = {
        ...template,
        id:            newId(),
        prompt:        'New question',
        options:       [
          { id: newId(), text: 'Option A' },
          { id: newId(), text: 'Option B' },
        ],
        correctOptionId: '',
        explanation:     '',
        altExplanation:  '',
        note:            undefined,
        result: {
          chosenOptionId:  '',
          correct:         false,
          score:           0,
          attemptedAt:     NOT_ATTEMPTED,
          passThreshold:   80,
          acknowledgement: '',
        },
      }
      fresh.correctOptionId = fresh.options[0]?.id ?? ''
      return withQuiz(state, [...quiz, fresh], fresh.id)
    }

    // ── Merge topics ─────────────────────────────────────────────────────────
    case 'MERGE_TOPICS': {
      const { index } = action
      if (index < 0 || index >= topics.length - 1) return state
      const a = topics[index]
      const b = topics[index + 1]
      const joinParts = (x: string, y: string) =>
        [x.trim(), y.trim()].filter(Boolean).join(' ')
      const merged: Topic = {
        ...a,
        end:       b.end,
        answer:    joinParts(a.answer, b.answer),
        altAnswer: joinParts(a.altAnswer, b.altAnswer),
        detail:    joinParts(a.detail, b.detail),
        note:      (a.note?.kind !== 'none' && a.note) ? a.note : b.note,
      }
      const next = [
        ...topics.slice(0, index),
        merged,
        ...topics.slice(index + 2),
      ]
      return withTopics(state, next, merged.id)
    }

    // ── Split topic ──────────────────────────────────────────────────────────
    case 'SPLIT_TOPIC': {
      const idx = topics.findIndex(t => t.id === action.id)
      if (idx < 0) return state
      const t = topics[idx]
      const mid = Math.round((t.start + t.end) / 2)
      const first: Topic  = { ...t, end: mid }
      const second: Topic = {
        ...t,
        id:    newId(),
        title: `${t.title} (continued)`,
        start: mid,
        note:  undefined,
      }
      const next = [
        ...topics.slice(0, idx),
        first,
        second,
        ...topics.slice(idx + 1),
      ]
      return withTopics(state, next, second.id)
    }

    default:
      return state
  }
}

// ─── Initialiser ─────────────────────────────────────────────────────────────

/** Builds the starting ConsoleState from a profile. */
export function initConsoleState(profile: Profile): ConsoleState {
  return {
    profile,
    selectedTopicId:    profile.topics[0]?.id ?? '',
    selectedQuestionId: profile.quiz[0]?.id ?? '',
  }
}
