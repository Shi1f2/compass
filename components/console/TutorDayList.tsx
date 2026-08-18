/**
 * components/console/TutorDayList.tsx
 * Left panel of the Knowledge tab — one row per knowledge topic.
 */
'use client'

import { useRef, useState } from 'react'
import { ArrowDownUp, Check, Lock, Plus, X } from 'lucide-react'
import type { TutorDispatch } from '@/lib/consoleState'
import type { QuizDay } from '@/lib/quizGroup'
import { NOT_ATTEMPTED } from '@/lib/quizGroup'

const PASS = 80

interface TutorDayListProps {
  days:        QuizDay[]
  selectedDay: number
  dispatch:    (a: TutorDispatch) => void
}

export default function TutorDayList({ days, selectedDay, dispatch }: TutorDayListProps) {
  const dragSrc  = useRef<number | null>(null)
  const [dragOver, setDragOver]   = useState<number | null>(null)
  const [dragging, setDragging]   = useState<number | null>(null)

  const selDay  = days.find(d => d.day === selectedDay)
  const selIdx  = days.findIndex(d => d.day === selectedDay)

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function onDragStart(e: React.DragEvent, idx: number) {
    if (days[idx]!.locked) { e.preventDefault(); return }
    dragSrc.current = idx
    setDragging(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragSrc.current !== null && idx !== dragSrc.current) setDragOver(idx)
  }

  function onDrop(e: React.DragEvent, toIdx: number) {
    e.preventDefault()
    const from = dragSrc.current
    if (from === null) return
    dispatch({ type: 'REORDER_DAYS', from, to: toIdx })
    dragSrc.current = null
    setDragOver(null)
    setDragging(null)
  }

  function onDragEnd() {
    dragSrc.current = null
    setDragOver(null)
    setDragging(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '24px 20px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="section-label">Topics</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-ink-muted)' }}>
            <ArrowDownUp size={12} strokeWidth={1.8} />
            drag to reorder
          </span>
        </div>
      </div>

      {/* Topic rows */}
      <ol
        className="thin-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          listStyle: 'none',
          margin: 0,
          padding: '0 16px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {days.map((day, idx) => {
          const isSelected = day.day === selectedDay
          const isDragged  = dragging === idx
          const isOver     = dragOver === idx && dragging !== null && dragging !== idx
          const attempted  = day.questions.filter(q => q.result && q.result.attemptedAt !== NOT_ATTEMPTED).length
          const total      = day.questions.length
          const scores     = day.questions
            .filter(q => q.result && q.result.attemptedAt !== NOT_ATTEMPTED)
            .map(q => q.result!.score)
          const avg       = scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null
          const passes    = avg !== null && avg >= PASS

          return (
            <li
              key={day.day}
              style={{
                position:    'relative',
                opacity:     isDragged ? 0.4 : 1,
              }}
            >
              {/* Insertion line above this row */}
              {isOver && (
                <div
                  style={{
                    position:   'absolute',
                    top:        -2,
                    left:       8,
                    right:      8,
                    height:     2,
                    background: 'var(--color-accent)',
                    borderRadius: 1,
                    zIndex:     10,
                    pointerEvents: 'none',
                  }}
                />
              )}
              <button
                type="button"
                draggable={!day.locked}
                onDragStart={e => onDragStart(e, idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDrop={e => onDrop(e, idx)}
                onDragEnd={onDragEnd}
                disabled={day.locked}
                onClick={() => {
                  if (!day.locked) dispatch({ type: 'SELECT_DAY', day: day.day })
                }}
                style={{
                  display:       'block',
                  width:         '100%',
                  padding:       '12px 16px',
                  borderRadius:  14,
                  border:        'none',
                  textAlign:     'left',
                  cursor:        day.locked ? 'not-allowed'
                                : isDragged ? 'grabbing' : 'grab',
                  background:    isSelected
                                 ? 'var(--color-violet-soft)'
                                 : 'transparent',
                  color:         day.locked ? 'var(--color-locked)' : 'var(--color-ink)',
                  fontFamily:    'var(--font-sans)',
                  transition:    'background 150ms',
                }}
                onMouseEnter={e => {
                  if (!day.locked && !isSelected)
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-sunk)'
                }}
                onMouseLeave={e => {
                  if (!isSelected)
                    (e.currentTarget as HTMLButtonElement).style.background = isSelected ? 'var(--color-violet-soft)' : 'transparent'
                }}
              >
                {/* Title line — wraps rather than truncates so long titles are readable */}
                <div
                  style={{
                    fontSize:   13,
                    lineHeight: 1.4,
                    fontWeight: isSelected ? 600 : 500,
                    color:      isSelected ? 'var(--color-violet)' : day.locked ? 'var(--color-locked)' : 'var(--color-ink)',
                  }}
                >
                  {day.topicLabel}
                </div>

                {/* Meta line */}
                <div
                  style={{
                    display:            'flex',
                    alignItems:         'center',
                    gap:                10,
                    marginTop:          4,
                    fontSize:           11,
                    fontVariantNumeric: 'tabular-nums',
                    color:              'var(--color-ink-muted)',
                  }}
                >
                  <span>{attempted}/{total} answered</span>
                  {day.locked ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-locked)' }}>
                      <Lock size={10} />
                      Locked
                    </span>
                  ) : avg !== null ? (
                    <span
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        color: passes ? 'var(--color-correct)' : 'var(--color-incorrect)',
                      }}
                    >
                      {passes
                        ? <Check size={10} strokeWidth={2.6} />
                        : <X    size={10} strokeWidth={2.6} />
                      }
                      {avg}%
                    </span>
                  ) : null}
                </div>
              </button>
            </li>
          )
        })}
      </ol>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          padding:   16,
          display:   'flex',
          flexDirection: 'column',
          gap:       8,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="btn-secondary"
          style={{ width: '100%', fontSize: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          disabled={selDay?.locked ?? true}
          onClick={() => selDay && dispatch({ type: 'ADD_QUESTION', day: selDay.day })}
        >
          <Plus size={14} />
          Add question to this topic
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ width: '100%', fontSize: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={() => dispatch({ type: 'ADD_DAY' })}
        >
          <Plus size={14} />
          Add topic
        </button>
      </div>
    </div>
  )
}
