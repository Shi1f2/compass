/**
 * components/console/SupervisorPage.tsx
 * Supervisor landing page — roster grid, invite flow, per-person detail.
 */
'use client'

import React, {
  useEffect, useReducer, useRef, useState,
} from 'react'
import {
  ArrowLeft, Check, GraduationCap,
  Plus, Search, Shield, X,
} from 'lucide-react'
import {
  ROSTER, PASS_THRESHOLD, ROLE_CHECKLISTS,
  answeredCount, averageScore,
  doneCount, setupPct, knowledgePct,
  type Starter,
  type InviteRole, type InviteChecklistItem,
} from '@/lib/supervisorData'
import { groupByDay, NOT_ATTEMPTED } from '@/lib/quizGroup'
import type { Question } from '@/lib/types'
import {
  PROGRAMME, topicState,
  programmeDoneTasks, programmeTotalTasks, programmeCompletionPct,
} from '@/lib/onboarding'
import type { ProgramTopic } from '@/lib/onboarding'
import TutorDayList from './TutorDayList'
import TutorQuestionView from './TutorQuestionView'

// ─── Constants ────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INVITE_ROLES: InviteRole[] = ['Engineer', 'Analyst', 'Contractor', 'Support', 'Marketing']
const CHECKLIST_SYSTEMS = ['ITSM', 'HRIS', 'Docs', 'Project', 'Device'] as const

// ─── Avatar ───────────────────────────────────────────────────────────────────

const TINTS = [
  { bg: 'var(--color-violet-soft)', text: 'var(--color-violet)'  },
  { bg: 'var(--color-accent-soft)', text: 'var(--color-accent)'  },
  { bg: 'var(--color-yellow-soft)', text: 'var(--color-waiting)' },
  { bg: 'var(--color-correct-soft)',text: 'var(--color-correct)' },
]

/**
 * Initials on a soft tint rather than a black disc, so a roster reads as a
 * set of people and not a column of identical chips.
 */
export function Avatar({ initials, size = 44 }: { initials: string; size?: number }) {
  const code  = initials.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  const tint  = TINTS[code % TINTS.length]!
  const fsize = Math.round(size * 0.34)
  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: tint.bg, color: tint.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: fsize, fontWeight: 600, flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  )
}

// ─── Score label ──────────────────────────────────────────────────────────────

export function ScoreLabel({ score }: { score: number | null }) {
  if (score === null) {
    return <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)' }}>—</span>
  }
  const pass = score >= PASS_THRESHOLD
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      color: pass ? 'var(--color-correct)' : 'var(--color-incorrect)',
    }}>
      {score}%
    </span>
  )
}

// ─── Labelled bar ─────────────────────────────────────────────────────────────

/**
 * Used twice per card so the two dimensions read as visually equal, rather
 * than one being the real bar and the other an afterthought.
 */
function LabelledBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 68, fontSize: 11, color: 'var(--color-ink-muted)', flexShrink: 0 }}>{label}</span>
      <div className="track" style={{ flex: 1, height: 8 }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 9999, background: color }} />
      </div>
      <span style={{
        width: 36, textAlign: 'right', fontSize: 11, fontWeight: 500,
        fontVariantNumeric: 'tabular-nums', color: 'var(--color-ink-muted)',
      }}>{pct}%</span>
    </div>
  )
}

// ─── Knowledge toggle ─────────────────────────────────────────────────────────

function KnowledgeToggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      title={on ? 'Has a quiz question' : 'No quiz question'}
      aria-pressed={on}
      onClick={e => { e.stopPropagation(); onChange() }}
      style={{
        width: 32, height: 32, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', cursor: 'pointer', flexShrink: 0,
        background: on ? 'var(--color-violet-soft)' : 'var(--color-sunk)',
        color:      on ? 'var(--color-violet)'       : 'var(--color-locked)',
      }}
    >
      <GraduationCap size={14} />
    </button>
  )
}

// ─── Invite row ───────────────────────────────────────────────────────────────

function InviteRow({
  item, onChange, onRemove,
}: {
  item:     InviteChecklistItem
  onChange: (patch: Partial<InviteChecklistItem>) => void
  onRemove: () => void
}) {
  return (
    <div
      className="row-item"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
      }}
    >
      <input
        type="checkbox"
        checked={item.included}
        onChange={e => onChange({ included: e.target.checked })}
        style={{ accentColor: 'var(--color-accent)', flexShrink: 0 }}
      />
      <select
        value={item.system}
        onChange={e => onChange({ system: e.target.value as typeof item.system })}
        style={{
          fontSize: 11, borderRadius: 9999, border: 'none',
          background: 'var(--color-sunk)', padding: '3px 8px',
          color: 'var(--color-ink-muted)', cursor: 'pointer',
          textTransform: 'uppercase', fontFamily: 'var(--font-sans)',
        }}
      >
        {CHECKLIST_SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <span
        style={{
          flex: 1, fontSize: 12, fontWeight: 500, minWidth: 0,
          color: item.included ? 'var(--color-ink)' : 'var(--color-ink-muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {item.label}
      </span>
      <KnowledgeToggle on={item.hasKnowledge} onChange={() => onChange({ hasKnowledge: !item.hasKnowledge })} />
      <button
        type="button"
        onClick={onRemove}
        style={{
          width: 24, height: 24, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--color-border)', background: 'var(--color-surface)',
          cursor: 'pointer', color: 'var(--color-ink-muted)', flexShrink: 0,
        }}
      >
        <X size={11} />
      </button>
    </div>
  )
}

// ─── Invite dialog ────────────────────────────────────────────────────────────

interface InviteDialogProps {
  onClose:    () => void
  onSent:     (email: string, role: InviteRole) => void
}

function InviteDialog({ onClose, onSent }: InviteDialogProps) {
  const [email,     setEmail]     = useState('')
  const [role,      setRole]      = useState<InviteRole | null>(null)
  const [rows,      setRows]      = useState<InviteChecklistItem[]>([])
  const [error,     setError]     = useState('')
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => { emailRef.current?.focus() }, [])

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  function selectRole(r: InviteRole) {
    setRole(r)
    setRows(ROLE_CHECKLISTS[r].map(item => ({ ...item, id: `${item.id}-${Date.now()}` })))
  }

  function updateRow(id: string, patch: Partial<InviteChecklistItem>) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function removeRow(id: string) {
    setRows(rs => rs.filter(r => r.id !== id))
  }

  function addRow() {
    setRows(rs => [...rs, {
      id: `inv-new-${Date.now()}`,
      label: 'New item', system: 'ITSM', included: true, hasKnowledge: false,
    }])
  }

  function handleSend() {
    if (!EMAIL_RE.test(email)) { setError('Enter a valid email address.'); return }
    if (!role)                  { setError('Choose a role before sending.'); return }
    onSent(email, role)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
    >
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'color-mix(in srgb, var(--color-ink) 25%, transparent)',
        }}
      />
      {/* Dialog */}
      <div
        className="animate-fade-up thin-scroll"
        style={{
          position: 'relative', zIndex: 1,
          maxWidth: 580, width: '90vw',
          maxHeight: '90vh', overflowY: 'auto',
          borderRadius: 24, background: 'var(--color-surface)',
          padding: 32, boxShadow: 'var(--shadow-float)',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Invite a new starter</h2>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-ink-muted)' }}>
          They&rsquo;ll get an email with a link to set up their account and start onboarding.
        </p>

        {/* Email */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          Email
          <input
            ref={emailRef}
            type="email"
            className="field"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            placeholder="jamie.rivera@brightfield.com"
          />
        </label>

        {/* Role */}
        <div>
          <div style={{ fontSize: 13, marginBottom: 10, fontWeight: 500 }}>Role</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {INVITE_ROLES.map(r => (
              <button
                key={r} type="button"
                onClick={() => selectRole(r)}
                style={{
                  padding: '8px 16px', borderRadius: 9999, border: 'none',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  background: role === r ? 'var(--color-violet)'     : 'var(--color-sunk)',
                  color:      role === r ? '#fff'                     : 'var(--color-ink-muted)',
                  transition: 'background 150ms, color 150ms',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Checklist */}
        {role && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Checklist</span>
              <button type="button" className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }} onClick={addRow}>
                <Plus size={12} /> Add item
              </button>
            </div>
            <div
              className="thin-scroll"
              style={{
                maxHeight: 280, overflowY: 'auto',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              {rows.map(row => (
                <InviteRow
                  key={row.id}
                  item={row}
                  onChange={p => updateRow(row.id, p)}
                  onRemove={() => removeRow(row.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-incorrect)' }}>{error}</p>
        )}

        {/* Footer */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary"   onClick={handleSend}>Send invite</button>
        </div>
      </div>
    </div>
  )
}

// ─── Starter card ─────────────────────────────────────────────────────────────

function StarterCard({ starter, onClick }: { starter: Starter; onClick: () => void }) {
  const avg    = averageScore(starter)
  const setup  = setupPct(starter)
  const know   = knowledgePct(starter)
  const done   = doneCount(starter)
  const total  = starter.checklist.length
  const ans    = answeredCount(starter)
  const totalQ = starter.quiz.length

  return (
    <button
      type="button"
      className="card-btn"
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column',
        padding: 24, gap: 0, width: '100%',
      }}
    >
      {/* Person */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Avatar initials={starter.initials} size={40} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {starter.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {starter.jobTitle} &middot; {starter.team}
          </div>
        </div>
      </div>

      {/* Bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <LabelledBar label="Setup"     pct={setup} color="var(--color-accent)" />
        <LabelledBar label="Knowledge" pct={know}  color="var(--color-violet)" />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
        <span style={{ fontSize: 11, color: 'var(--color-ink-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {done}/{total} tasks &middot; {ans}/{totalQ} Qs
        </span>
        <ScoreLabel score={avg} />
      </div>
    </button>
  )
}

// ─── Knowledge tab (local reducer) ───────────────────────────────────────────

/**
 * Only the state it is wired to differs — a small local reducer scoped to
 * one starter's quiz rather than the app-wide console reducer.
 */
interface KnowledgeState {
  quiz:               Question[]
  selectedQuestionId: string
}

type KnowledgeAction =
  | { type: 'SELECT';        list: 'quiz'; id: string }
  | { type: 'PATCH';         list: 'quiz'; id: string; patch: Partial<Question> }
  | { type: 'REGENERATE';    list: 'quiz'; id: string }
  | { type: 'SELECT_DAY';    day: number }
  | { type: 'REORDER_DAYS';  from: number; to: number }
  | { type: 'ADD_DAY' }
  | { type: 'ADD_QUESTION';  day: number }

function knowledgeReducer(state: KnowledgeState, action: KnowledgeAction): KnowledgeState {
  const { quiz } = state

  if (action.type === 'SELECT') {
    return { ...state, selectedQuestionId: action.id }
  }
  if (action.type === 'PATCH') {
    return { ...state, quiz: quiz.map(q => q.id === action.id ? { ...q, ...action.patch } : q) }
  }
  if (action.type === 'REGENERATE') {
    return {
      ...state,
      quiz: quiz.map(q =>
        q.id === action.id ? { ...q, explanation: q.altExplanation, altExplanation: q.explanation } : q
      ),
    }
  }
  if (action.type === 'SELECT_DAY') {
    const first = quiz.find(q => q.start === action.day)
    return first ? { ...state, selectedQuestionId: first.id } : state
  }
  if (action.type === 'REORDER_DAYS') {
    const days = groupByDay(quiz)
    if (action.from === action.to) return state
    const blocks = [...days]
    const [block] = blocks.splice(action.from, 1)
    blocks.splice(action.to, 0, block!)
    return { ...state, quiz: blocks.flatMap(d => d.questions) }
  }
  if (action.type === 'ADD_DAY') {
    const days = groupByDay(quiz)
    const lastDay = days[days.length - 1]
    const newDay  = lastDay ? lastDay.day + 5 : 0
    const newId   = `kt-d${newDay}-${Date.now()}`
    const q: Question = {
      id: newId, dayLabel: 'New topic', prompt: 'New question',
      system: 'Docs', options: [{ id: 'a', text: 'Option A' }, { id: 'b', text: 'Option B' }],
      correctOptionId: 'a', explanation: '', altExplanation: '',
      highlight: { x: 0.3, y: 0.34, width: 0.4, height: 0.2, label: 'region' },
      scene: { view: 'quiz', sidebarIndex: 6, rowIndex: -1 },
      start: newDay, end: newDay + 1, points: 10,
      result: { chosenOptionId: '', correct: false, score: 0, attemptedAt: NOT_ATTEMPTED, passThreshold: 80, acknowledgement: '' },
    }
    return { quiz: [...quiz, q], selectedQuestionId: q.id }
  }
  if (action.type === 'ADD_QUESTION') {
    const template = quiz.find(q => q.start === action.day)
    if (!template) return state
    const newId = `kt-${action.day}-${Date.now()}`
    const q: Question = {
      ...template, id: newId, prompt: 'New question',
      options: [{ id: 'a', text: 'Option A' }, { id: 'b', text: 'Option B' }],
      correctOptionId: 'a', explanation: '', altExplanation: '', note: undefined,
      result: { chosenOptionId: '', correct: false, score: 0, attemptedAt: NOT_ATTEMPTED, passThreshold: 80, acknowledgement: '' },
    }
    return { quiz: [...quiz, q], selectedQuestionId: q.id }
  }
  return state
}

function KnowledgeTab({ starter }: { starter: Starter }) {
  const [state, dispatch] = useReducer(
    knowledgeReducer,
    { quiz: starter.quiz, selectedQuestionId: starter.quiz[0]?.id ?? '' },
  )

  const days = groupByDay(state.quiz)
  const currentDay = days.find(d => d.questions.some(q => q.id === state.selectedQuestionId)) ?? days[0]

  if (!currentDay) return <div style={{ padding: 32, color: 'var(--color-ink-muted)' }}>No quiz data.</div>

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <aside style={{ width: 320, flexShrink: 0, borderRight: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <TutorDayList days={days} selectedDay={currentDay.day} dispatch={dispatch} />
      </aside>
      <TutorQuestionView
        day={currentDay}
        days={days}
        selectedQuestionId={state.selectedQuestionId}
        dispatch={dispatch}
      />
    </div>
  )
}

// ─── Deadline label (shared rendering rule) ───────────────────────────────────

function DeadlineLabel({ done, daysLeft }: { done: boolean; daysLeft: number }) {
  if (done) {
    return (
      <span style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 11, fontWeight: 500,
        color: 'var(--color-ink-muted)',
        flexShrink: 0, whiteSpace: 'nowrap',
      }}>
        <Check size={11} strokeWidth={2.5} />
        Done
      </span>
    )
  }

  let text: string
  if (daysLeft < 0) {
    const n = Math.abs(daysLeft)
    text = `${n} ${n === 1 ? 'day' : 'days'} overdue`
  } else if (daysLeft === 0) {
    text = 'Due today'
  } else if (daysLeft === 1) {
    text = '1 day left'
  } else {
    text = `${daysLeft} days left`
  }

  const color =
    daysLeft < 0  ? 'var(--color-incorrect)' :
    daysLeft <= 2 ? 'var(--color-accent)'     :
    daysLeft <= 7 ? 'var(--color-ink)'        :
                    'var(--color-ink-muted)'

  return (
    <span style={{
      fontSize: 11, fontWeight: 500, color,
      flexShrink: 0, whiteSpace: 'nowrap',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {text}
    </span>
  )
}

// ─── Segmented programme bar ──────────────────────────────────────────────────

function ProgrammeBar({ topics, onScrollTo }: { topics: ProgramTopic[]; onScrollTo: (id: number) => void }) {
  const totalTasks = topics.reduce((s, t) => s + t.tasks.length, 0)
  const doneTasks  = topics.reduce((s, t) => s + t.tasks.filter(x => x.done).length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {/* Meta header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          Onboarding programme
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>
          {topics.length} topics &middot; {totalTasks} tasks
        </span>
      </div>

      {/* Segmented bar */}
      <div style={{ display: 'flex', gap: 3, height: 20, borderRadius: 10, overflow: 'hidden' }}>
        {topics.map(t => {
          const state    = topicState(t.tasks)
          const doneC    = t.tasks.filter(x => x.done).length
          const label    = state === 'in-progress'
            ? `${doneC} / ${t.tasks.length}`
            : `${t.tasks.length}`
          const bg =
            state === 'complete'    ? 'var(--color-violet)'      :
            state === 'in-progress' ? 'var(--color-accent)'      :
                                      'var(--color-violet-soft)'
          const fg =
            state === 'complete'    ? '#fff'                     :
            state === 'in-progress' ? '#fff'                     :
                                      'var(--color-violet)'
          return (
            <button
              key={t.id}
              type="button"
              title={t.title}
              onClick={() => onScrollTo(t.id)}
              style={{
                flexGrow: t.tasks.length,
                background: bg,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 600,
                color: fg,
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'var(--font-sans)',
                transition: 'filter 150ms',
                padding: 0,
                minWidth: 0,
                overflow: 'hidden',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(0.92)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.filter = 'none'}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--color-ink-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {doneTasks} of {totalTasks} tasks done
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>
          Go at your own pace
        </span>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {(
          [
            ['complete',    'var(--color-violet)',      'Done'        ],
            ['in-progress', 'var(--color-accent)',      'In progress' ],
            ['not-started', 'var(--color-violet-soft)', 'Not started' ],
          ] as const
        ).map(([, color, label]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-ink-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Checklist tab ────────────────────────────────────────────────────────────

function ChecklistTab({
  starter: _starter,
  containerStyle,
}: {
  starter: Starter
  containerStyle: React.CSSProperties
}) {
  const topicRefs = useRef<Record<number, HTMLElement | null>>({})

  function scrollToTopic(id: number) {
    topicRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    // Plain block — no overflow, no fixed height. The page is the scroll surface.
    <div style={{ paddingTop: 8 }}>
      <div style={{ ...containerStyle }}>

          {/* Programme bar */}
          <div className="card" style={{ padding: '24px 28px', marginBottom: 24 }}>
            <ProgrammeBar topics={PROGRAMME} onScrollTo={scrollToTopic} />
          </div>

          {/* Topic list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {PROGRAMME.map(topic => {
              const state  = topicState(topic.tasks)
              const doneC  = topic.tasks.filter(x => x.done).length
              const headerBg =
                state === 'complete'    ? 'var(--color-violet-soft)' :
                state === 'in-progress' ? 'var(--color-accent-soft)' :
                                          'var(--color-sunk)'
              const headerColor =
                state === 'complete'    ? 'var(--color-violet)' :
                state === 'in-progress' ? 'var(--color-accent)' :
                                          'var(--color-locked)'

              return (
                <section
                  key={topic.id}
                  ref={el => { topicRefs.current[topic.id] = el }}
                  className="card"
                  style={{ overflow: 'hidden', padding: 0 }}
                >
                  {/* Topic header */}
                  <div style={{
                    padding: '14px 20px',
                    background: headerBg,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: headerColor }}>
                      {topic.title}
                    </span>
                    {topic.evidence && (
                      <span
                        title="Completion recorded as compliance evidence"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: headerColor, opacity: 0.8, cursor: 'help' }}
                      >
                        <Shield size={12} />
                        Evidence
                      </span>
                    )}
                    <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: headerColor, opacity: 0.8, flexShrink: 0 }}>
                      {doneC}/{topic.tasks.length}
                    </span>
                  </div>

                  {/* Task rows */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {topic.tasks.map((task, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '13px 20px',
                          borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)',
                        }}
                      >
                        {/* Tick or empty circle */}
                        {task.done ? (
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                            background: state === 'complete' ? 'var(--color-violet)' : 'var(--color-accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Check size={12} strokeWidth={3} color="#fff" />
                          </div>
                        ) : (
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                            border: '1.5px solid var(--color-border)',
                            background: 'var(--color-surface)',
                          }} />
                        )}
                        <span style={{
                          fontSize: 13, fontWeight: 500, flex: 1,
                          color: task.done ? 'var(--color-ink-muted)' : 'var(--color-ink)',
                          textDecoration: task.done ? 'line-through' : 'none',
                        }}>
                          {task.name}
                        </span>
                        <DeadlineLabel done={task.done} daysLeft={task.daysLeft} />
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>

      </div>
    </div>
  )
}

// ─── Header stat tile ─────────────────────────────────────────────────────────

type StatTone = 'plain' | 'violet' | 'yellow' | 'correct' | 'incorrect'

const TONE_STYLES: Record<StatTone, { bg: string; color: string }> = {
  plain:     { bg: 'var(--color-sunk)',          color: 'var(--color-ink)'      },
  violet:    { bg: 'var(--color-violet-soft)',   color: 'var(--color-violet)'   },
  yellow:    { bg: 'var(--color-yellow-soft)',   color: 'var(--color-waiting)'  },
  correct:   { bg: 'var(--color-correct-soft)',  color: 'var(--color-correct)'  },
  incorrect: { bg: 'var(--color-incorrect-soft)',color: 'var(--color-incorrect)'},
}

function HeaderStat({ label, value, tone = 'plain' }: { label: string; value: string; tone?: StatTone }) {
  const s = TONE_STYLES[tone]
  return (
    <div
      style={{
        minWidth: 104, borderRadius: 16, padding: '12px 16px',
        background: s.bg, color: s.color,
      }}
    >
      <span className="section-label" style={{ opacity: 0.7, color: s.color, display: 'block', marginBottom: 4 }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

// ─── Detail view ─────────────────────────────────────────────────────────────

function DetailView({ starter, onBack }: { starter: Starter; onBack: () => void }) {
  const [tab, setTab] = useState<'checklist' | 'knowledge'>('checklist')
  // Task-based progress from the shared programme — matches the bar below.
  const taskDone  = programmeDoneTasks()
  const taskTotal = programmeTotalTasks()
  const checkPct  = programmeCompletionPct()
  const avg    = averageScore(starter)
  const ans    = answeredCount(starter)
  const totalQ = starter.quiz.length

  // Escape goes back
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onBack() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onBack])

  const avgTone: StatTone = avg === null ? 'plain' : avg >= PASS_THRESHOLD ? 'correct' : 'incorrect'
  const avgDisplay = avg === null ? '—' : `${avg}%`

  // Shared container: every row in this view aligns to the same column.
  const W: React.CSSProperties = { maxWidth: 1100, margin: '0 auto', padding: '0 24px', width: '100%' }

  return (
    // Plain block — the parent thin-scroll wrapper owns all scrolling.
    // No height, no overflow here.
    <div style={{ background: 'var(--color-page)', paddingBottom: 48 }}>

      {/* Back row */}
      <div style={{ ...W, paddingTop: 12, paddingBottom: 12 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 9999, border: 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: 'transparent', color: 'var(--color-ink-muted)',
            fontFamily: 'var(--font-sans)',
            transition: 'background 150ms, color 150ms',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-sunk)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-ink)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-ink-muted)' }}
        >
          <ArrowLeft size={16} /> All new starters
        </button>
      </div>

      {/* Header card */}
      <div style={{ ...W, paddingBottom: 20 }}>
        <div
          className="card"
          style={{
            padding: 28, display: 'flex', flexWrap: 'wrap',
            gap: 28, alignItems: 'flex-start',
          }}
        >
          {/* Identity */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <Avatar initials={starter.initials} size={72} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{starter.name}</div>
              <div style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 }}>
                {starter.jobTitle} &middot; {starter.team}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-ink-muted)', marginTop: 4 }}>
                Started {starter.startDate}
              </div>
            </div>
          </div>

          {/* Stats row — all derived from the shared programme data */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
            <HeaderStat label="Checklist" value={`${checkPct}%`}            tone="violet" />
            <HeaderStat label="Tasks"     value={`${taskDone}/${taskTotal}`} tone="plain"  />
            <HeaderStat label="Answered"  value={`${ans}/${totalQ}`}         tone="yellow" />
            <HeaderStat label="Average"   value={avgDisplay}                 tone={avgTone} />
          </div>

          {/* Progress track — matches the Checklist stat above */}
          <div className="track" style={{ width: '100%', height: 6, marginTop: 4 }}>
            <div className="track-fill" style={{ width: `${checkPct}%`, height: '100%' }} />
          </div>
        </div>
      </div>

      {/* Tab strip */}
      <div style={{ ...W, paddingBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['checklist', 'knowledge'] as const).map(t => (
            <button
              key={t} type="button"
              onClick={() => setTab(t)}
              style={{
                padding: '8px 16px', borderRadius: 9999, border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                textTransform: 'capitalize', fontFamily: 'var(--font-sans)',
                background: tab === t ? 'var(--color-accent-soft)' : 'transparent',
                color:      tab === t ? 'var(--color-accent)'      : 'var(--color-ink-muted)',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab body — keyed by starter so switching people remounts.
          Checklist renders as plain block flow (page scrolls).
          Knowledge keeps its own internal two-pane layout. */}
      <div key={starter.id}>
        {tab === 'checklist'
          ? <ChecklistTab starter={starter} containerStyle={W} />
          : (
            <div style={{ height: 'calc(100vh - 280px)', display: 'flex', overflow: 'hidden' }}>
              <KnowledgeTab starter={starter} />
            </div>
          )
        }
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SupervisorPageProps {
  name:    string
  company: string
}

export default function SupervisorPage({ name, company }: SupervisorPageProps) {
  const [search,    setSearch]    = useState('')
  const [selected,  setSelected]  = useState<Starter | null>(null)
  const [invite,    setInvite]    = useState(false)
  const [confirm,   setConfirm]   = useState('')

  const filtered = ROSTER.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  function handleSent(email: string, role: InviteRole) {
    setInvite(false)
    setConfirm(`Invitation sent to ${email} as ${role}`)
    setTimeout(() => setConfirm(''), 4000)
  }

  if (selected) {
    return (
      <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <DetailView starter={selected} onBack={() => setSelected(null)} />
      </div>
    )
  }

  const noun = filtered.length === 1 ? 'new starter' : 'new starters'

  return (
    <div
      className="thin-scroll"
      style={{ flex: 1, overflowY: 'auto', background: 'var(--color-page)' }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 20, flexWrap: 'wrap' }}>
          <div>
            <span className="section-label" style={{ display: 'block', marginBottom: 6 }}>
              {name} &middot; {company || 'Brightfield'}
            </span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>
              Onboarding, {ROSTER.length} {ROSTER.length === 1 ? 'new starter' : 'new starters'}
            </h1>
          </div>
          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 300, width: '100%' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink-muted)', pointerEvents: 'none' }}
            />
            <input
              type="search"
              className="field"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name…"
              style={{ paddingLeft: 44 }}
            />
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', textAlign: 'center', padding: '48px 0' }}>
            No new starters match &ldquo;{search}&rdquo;.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 20,
            }}
          >
            {filtered.map(s => (
              <StarterCard key={s.id} starter={s} onClick={() => setSelected(s)} />
            ))}
          </div>
        )}

        {/* Invite button */}
        <button
          type="button"
          className="btn-secondary"
          style={{ width: '100%', marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={() => setInvite(true)}
        >
          <Plus size={15} /> Invite new starter
        </button>
      </div>

      {/* Invite dialog */}
      {invite && (
        <InviteDialog onClose={() => setInvite(false)} onSent={handleSent} />
      )}

      {/* Confirmation toast */}
      {confirm && (
        <div
          className="animate-fade-up"
          style={{
            position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--color-ink)', color: '#fff',
            borderRadius: 9999, padding: '12px 24px',
            fontSize: 13, boxShadow: 'var(--shadow-float)',
            whiteSpace: 'nowrap', zIndex: 200,
          }}
        >
          {confirm}
        </div>
      )}
    </div>
  )
}
