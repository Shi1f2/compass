/**
 * components/console/OnboardingProgramme.tsx
 * New starter's view of their onboarding programme.
 *
 * All state is local — ticking a checkbox updates this component only and
 * resets on reload. No backend, no persistence: expected and correct for
 * this demo.
 *
 * Supervisor-only concepts (scores, question review, other people) are
 * deliberately absent from this component.
 */
'use client'

import { useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Shield } from 'lucide-react'
import { PROGRAMME, topicState } from '@/lib/onboarding'
import type { ProgramTask, ProgramTopic } from '@/lib/onboarding'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Mutable local state for a topic's task list */
type TopicState = { topicId: number; tasks: ProgramTask[] }

// ─── Deadline label ───────────────────────────────────────────────────────────

/**
 * Right-aligned countdown shown on every task row.
 * Done tasks show a tick + "Done" in muted text — never a deadline.
 * Colour encodes urgency: red = overdue, orange ≤ 2, default 3-7, muted > 7.
 */
function DeadlineLabel({ done, daysLeft }: { done: boolean; daysLeft: number }) {
  if (done) {
    return (
      <span style={{
        display:    'flex',
        alignItems: 'center',
        gap:        4,
        fontSize:   11,
        fontWeight: 500,
        color:      'var(--color-ink-muted)',
        flexShrink: 0,
        whiteSpace: 'nowrap',
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
      fontSize:           11,
      fontWeight:         500,
      color,
      flexShrink:         0,
      whiteSpace:         'nowrap',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {text}
    </span>
  )
}

// ─── Segmented bar ────────────────────────────────────────────────────────────

interface BarProps {
  topics:     { id: number; taskCount: number; doneCount: number }[]
  onScrollTo: (id: number) => void
}

function ProgrammeBar({ topics, onScrollTo }: BarProps) {
  const totalTasks = topics.reduce((s, t) => s + t.taskCount, 0)
  const doneTasks  = topics.reduce((s, t) => s + t.doneCount, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Your onboarding programme</span>
        <span style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>
          {topics.length} topics &middot; {totalTasks} tasks
        </span>
      </div>

      {/* Segmented bar */}
      <div style={{ display: 'flex', gap: 3, height: 20, borderRadius: 10, overflow: 'hidden' }}>
        {topics.map(t => {
          const state =
            t.doneCount === t.taskCount ? 'complete' :
            t.doneCount > 0            ? 'in-progress' :
                                         'not-started'
          const label =
            state === 'in-progress' ? `${t.doneCount} / ${t.taskCount}` : `${t.taskCount}`
          const bg =
            state === 'complete'    ? 'var(--color-violet)'      :
            state === 'in-progress' ? 'var(--color-accent)'      :
                                      'var(--color-violet-soft)'
          const fg =
            state === 'complete'    ? '#fff' :
            state === 'in-progress' ? '#fff' :
                                      'var(--color-violet)'
          // Find the real topic title for the tooltip
          const topic = PROGRAMME.find(p => p.id === t.id)
          return (
            <button
              key={t.id}
              type="button"
              title={topic?.title ?? ''}
              onClick={() => onScrollTo(t.id)}
              style={{
                flexGrow:           t.taskCount,
                background:         bg,
                border:             'none',
                cursor:             'pointer',
                display:            'flex',
                alignItems:         'center',
                justifyContent:     'center',
                fontSize:           10,
                fontWeight:         600,
                color:              fg,
                fontVariantNumeric: 'tabular-nums',
                fontFamily:         'var(--font-sans)',
                transition:         'filter 150ms',
                padding:            0,
                minWidth:           0,
                overflow:           'hidden',
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
        <span style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>Go at your own pace</span>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {(
          [
            ['var(--color-violet)',      'Done'        ],
            ['var(--color-accent)',      'In progress' ],
            ['var(--color-violet-soft)', 'Not started' ],
          ] as const
        ).map(([color, label]) => (
          <span
            key={label}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-ink-muted)' }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: color, flexShrink: 0, display: 'inline-block',
            }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Continue card ────────────────────────────────────────────────────────────

interface ContinueCardProps {
  topicTitle: string
  taskName:   string
  onAsk:      () => void
}

function ContinueCard({ topicTitle, taskName, onAsk }: ContinueCardProps) {
  return (
    <div
      className="card"
      style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <span className="section-label" style={{ display: 'block', marginBottom: 4 }}>
          Continue where you left off
        </span>
        <div style={{ fontSize: 11, color: 'var(--color-ink-muted)', marginBottom: 6 }}>
          {topicTitle}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>
          {taskName}
        </div>
      </div>
      <button
        type="button"
        className="btn-primary"
        onClick={onAsk}
        style={{ flexShrink: 0 }}
      >
        Open in Mentor
      </button>
    </div>
  )
}

// ─── Topic section ────────────────────────────────────────────────────────────

interface TopicSectionProps {
  topic:       ProgramTopic
  tasks:       ProgramTask[]
  initialOpen: boolean
  onToggle:    (topicId: number, taskIdx: number, checked: boolean) => void
  onAsk:       (query: string) => void
  topicRef:    (el: HTMLElement | null) => void
}

function TopicSection({
  topic, tasks, initialOpen, onToggle, onAsk, topicRef,
}: TopicSectionProps) {
  const [open, setOpen] = useState(initialOpen)

  const doneCount  = tasks.filter(t => t.done).length
  const state      = topicState(tasks)
  const headerBg   =
    state === 'complete'    ? 'var(--color-violet-soft)' :
    state === 'in-progress' ? 'var(--color-accent-soft)' :
                              'var(--color-sunk)'
  const headerColor =
    state === 'complete'    ? 'var(--color-violet)' :
    state === 'in-progress' ? 'var(--color-accent)' :
                              'var(--color-locked)'

  return (
    <section
      ref={topicRef}
      className="card"
      style={{ overflow: 'hidden', padding: 0 }}
    >
      {/* Header — click to expand / collapse */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width:          '100%',
          padding:        '14px 20px',
          background:     headerBg,
          border:         'none',
          cursor:         'pointer',
          display:        'flex',
          alignItems:     'center',
          gap:            10,
          textAlign:      'left',
          fontFamily:     'var(--font-sans)',
          transition:     'filter 150ms',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(0.97)'}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.filter = 'none'}
      >
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: headerColor }}>
          {topic.title}
        </span>

        {topic.evidence && (
          <span
            title="Your completion is recorded for compliance"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: headerColor, opacity: 0.8, cursor: 'help',
            }}
          >
            <Shield size={12} />
            Evidence
          </span>
        )}

        <span style={{
          fontSize: 11, fontVariantNumeric: 'tabular-nums',
          color: headerColor, opacity: 0.8, flexShrink: 0,
        }}>
          {doneCount} of {tasks.length}
        </span>

        <span style={{ color: headerColor, opacity: 0.6, flexShrink: 0, display: 'flex' }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* Task rows */}
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {tasks.map((task, idx) => (
            <div
              key={idx}
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        12,
                padding:    '12px 20px',
                borderTop:  idx === 0 ? 'none' : '1px solid var(--color-border)',
              }}
            >
              {/* Checkbox */}
              <label
                style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:        12,
                  flex:       1,
                  cursor:     'pointer',
                  minWidth:   0,
                }}
              >
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={e => onToggle(topic.id, idx, e.target.checked)}
                  style={{ display: 'none' }}
                />
                {/* Custom circle tick */}
                <div
                  style={{
                    width:          22,
                    height:         22,
                    borderRadius:   '50%',
                    flexShrink:     0,
                    background:     task.done
                      ? (state === 'complete' ? 'var(--color-violet)' : 'var(--color-accent)')
                      : 'var(--color-surface)',
                    border:         task.done ? 'none' : '1.5px solid var(--color-border)',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    transition:     'background 150ms, border-color 150ms',
                  }}
                >
                  {task.done && <Check size={12} strokeWidth={3} color="#fff" />}
                </div>

                <span style={{
                  fontSize:       13,
                  fontWeight:     500,
                  color:          task.done ? 'var(--color-ink-muted)' : 'var(--color-ink)',
                  textDecoration: task.done ? 'line-through' : 'none',
                  transition:     'color 150ms',
                  flex:           1,
                  minWidth:       0,
                }}>
                  {task.name}
                </span>
              </label>

              {/* Deadline / done label */}
              <DeadlineLabel done={task.done} daysLeft={task.daysLeft} />

              {/* Ask mentor */}
              {!task.done && (
                <button
                  type="button"
                  onClick={() => onAsk(`${topic.title} — ${task.name}`)}
                  style={{
                    background:   'transparent',
                    border:       'none',
                    cursor:       'pointer',
                    fontSize:     12,
                    color:        'var(--color-ink-muted)',
                    fontFamily:   'var(--font-sans)',
                    fontWeight:   500,
                    padding:      '4px 8px',
                    borderRadius: 9999,
                    flexShrink:   0,
                    whiteSpace:   'nowrap',
                    transition:   'color 150ms, background 150ms',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.color       = 'var(--color-accent)'
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-soft)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.color       = 'var(--color-ink-muted)'
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  }}
                >
                  Ask mentor
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface OnboardingProgrammeProps {
  /** Called when the user wants to open the mentor with a pre-filled query */
  onAskMentor: (query: string) => void
}

export default function OnboardingProgramme({ onAskMentor }: OnboardingProgrammeProps) {
  // Local mutable copy of all task states, initialised from the shared seed
  const [topicStates, setTopicStates] = useState<TopicState[]>(() =>
    PROGRAMME.map(t => ({ topicId: t.id, tasks: t.tasks.map(x => ({ ...x })) }))
  )

  // Refs for scroll-into-view from bar clicks
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({})

  function scrollToTopic(id: number) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function toggleTask(topicId: number, taskIdx: number, checked: boolean) {
    setTopicStates(prev =>
      prev.map(ts =>
        ts.topicId !== topicId ? ts : {
          ...ts,
          tasks: ts.tasks.map((t, i) => i === taskIdx ? { ...t, done: checked } : t),
        }
      )
    )
  }

  // Derived bar data — recalculated from local state on every render
  const barTopics = topicStates.map(ts => ({
    id:        ts.topicId,
    taskCount: ts.tasks.length,
    doneCount: ts.tasks.filter(t => t.done).length,
  }))

  // First not-done task (for the continue card)
  let continueTopicTitle = ''
  let continueTaskName   = ''
  outer: for (const ts of topicStates) {
    const topic = PROGRAMME.find(p => p.id === ts.topicId)!
    for (const task of ts.tasks) {
      if (!task.done) {
        continueTopicTitle = topic.title
        continueTaskName   = task.name
        break outer
      }
    }
  }
  const allDone = !continueTaskName

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* 1 — Segmented bar */}
      <div className="card" style={{ padding: '24px 28px' }}>
        <ProgrammeBar topics={barTopics} onScrollTo={scrollToTopic} />
      </div>

      {/* 2 — Continue card (hidden when everything is done) */}
      {!allDone && (
        <ContinueCard
          topicTitle={continueTopicTitle}
          taskName={continueTaskName}
          onAsk={() => onAskMentor(`${continueTopicTitle} — ${continueTaskName}`)}
        />
      )}

      {/* 3 — Topic list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {PROGRAMME.map(topic => {
          const ts    = topicStates.find(s => s.topicId === topic.id)!
          const state = topicState(ts.tasks)
          // In-progress topic starts open; others start collapsed
          const initialOpen = state === 'in-progress'
          return (
            <TopicSection
              key={topic.id}
              topic={topic}
              tasks={ts.tasks}
              initialOpen={initialOpen}
              onToggle={toggleTask}
              onAsk={onAskMentor}
              topicRef={el => { sectionRefs.current[topic.id] = el }}
            />
          )
        })}
      </div>

    </div>
  )
}
