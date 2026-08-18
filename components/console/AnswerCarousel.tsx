/**
 * components/console/AnswerCarousel.tsx
 * Mentor tab answer view: long answer cut into sentence-steps, presented
 * as a horizontally swipeable card stack via PeekCarousel.
 *
 * The slide count is always steps.length + 1 (for the closing card).
 * Every answer goes through the carousel whatever its step count — a
 * one-sentence answer is simply two slides with the progress bar reading as
 * full. There is deliberately no separate single-step layout: having one meant
 * the card changed width and lost its progress bar as soon as an answer
 * happened to be one sentence long, so the page jumped between questions.
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronDown, FileDown, Info, RefreshCw, TriangleAlert, Users,
} from 'lucide-react'
import type { Topic } from '@/lib/types'
import type { ConsoleAction } from '@/lib/consoleState'
import { splitAnswer } from '@/lib/splitAnswer'
import { dayLabel } from '@/lib/format'
import FrameImage from '@/components/FrameImage'
import PeekCarousel from './PeekCarousel'

// ─── Collapsible row ──────────────────────────────────────────────────────────

function CollapsibleRow({
  label,
  icon,
  children,
  isActive,
  last = false,
}: {
  label: string
  icon?: React.ReactNode
  children: React.ReactNode
  isActive: boolean
  last?: boolean
}) {
  const [open, setOpen] = useState(false)

  // Collapse when this slide is no longer active
  useEffect(() => {
    if (!isActive) setOpen(false)
  }, [isActive])

  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid var(--color-border)' }}>
      <button
        type="button"
        tabIndex={isActive ? 0 : -1}
        onClick={() => setOpen(o => !o)}
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          width:          '100%',
          padding:        '12px 0',
          background:     'none',
          border:         'none',
          cursor:         'pointer',
          fontSize:       13,
          fontWeight:     500,
          color:          'var(--color-ink)',
          fontFamily:     'var(--font-sans)',
          gap:            8,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          {label}
        </span>
        <ChevronDown
          size={14}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms', flexShrink: 0 }}
        />
      </button>
      {open && (
        <p
          className="animate-fade-up"
          style={{
            margin:     '0 0 12px',
            fontSize:   13,
            lineHeight: 1.6,
            color:      'var(--color-ink-muted)',
          }}
        >
          {children}
        </p>
      )}
    </div>
  )
}

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ system }: { system: string }) {
  return (
    <span
      className="pill"
      style={{
        background:    'var(--color-violet-soft)',
        color:         'var(--color-violet)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        gap:           8,
      }}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--color-violet)', flexShrink: 0,
        }}
      />
      {system}
    </span>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AnswerCarouselProps {
  topic:        Topic
  dispatch:     (a: ConsoleAction) => void
  onReport:     () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnswerCarousel({ topic, dispatch, onReport }: AnswerCarouselProps) {
  const steps        = splitAnswer(topic.answer)
  const slideCount   = steps.length + 1        // +1 for closing card
  const closingIdx   = steps.length

  const [activeIdx,    setActiveIdx]    = useState(0)
  const [regenerating, setRegenerating] = useState(false)

  // Reset to 0 on topic change; clamp if step count shrank
  useEffect(() => {
    setActiveIdx(0)
  }, [topic.id])

  useEffect(() => {
    setActiveIdx(i => Math.min(i, slideCount - 1))
  }, [slideCount])

  const handleRegenerate = useCallback(() => {
    setRegenerating(true)
    setTimeout(() => {
      dispatch({ type: 'REGENERATE', list: 'topics', id: topic.id })
      setRegenerating(false)
    }, 700)
  }, [dispatch, topic.id])

  // ── Progress bar width ─────────────────────────────────────────────────────
  // Progress is through the STEPS, not slides — the closing card is after the answer.
  // A one-step answer reads as full immediately rather than stalling at 50%.
  const progressPct = steps.length > 0
    ? Math.round((Math.min(activeIdx, steps.length) / steps.length) * 100)
    : 100

  // ── Render slide ──────────────────────────────────────────────────────────

  const renderSlide = useCallback((i: number, isActive: boolean) => {
    if (i === closingIdx) {
      // Closing card
      return (
        <div
          className="card"
          style={{
            minHeight:      260,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        36,
            gap:            16,
            width:          '100%',
            textAlign:      'center',
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-muted)', lineHeight: 1.6 }}>
            That&rsquo;s the full answer — report it, or ask again a different way.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 300 }}>
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={onReport}
              tabIndex={isActive ? 0 : -1}
            >
              <FileDown size={15} />
              Report
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={handleRegenerate}
              disabled={regenerating}
              tabIndex={isActive ? 0 : -1}
            >
              <RefreshCw
                size={15}
                style={regenerating ? { animation: 'spin 700ms linear infinite' } : undefined}
              />
              {regenerating ? 'Rewriting…' : 'Ask differently'}
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-ink-muted)' }}>
            Manager summary or compliance evidence pack, covering everything Compass has covered so far.
          </p>
        </div>
      )
    }

    const step       = steps[i]!
    const isLastStep = i === steps.length - 1
    const hasNote    = topic.note && topic.note.kind !== 'none'

    return (
      <div
        className="card"
        style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 0, width: '100%' }}
      >
        {/* Step header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width:          28,
              height:         28,
              borderRadius:   '50%',
              background:     'var(--color-violet-soft)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-violet)' }}>
              {i + 1}
            </span>
          </div>
          <span className="section-label">Step {i + 1} of {steps.length}</span>
        </div>

        {/* Step title */}
        <h3
          style={{
            margin:       '0 0 8px',
            fontSize:     16,
            fontWeight:   600,
            lineHeight:   1.2,
            color:        'var(--color-ink)',
          }}
        >
          {step.title}
        </h3>

        {/* Step text */}
        <p style={{ margin: '0 0 20px', fontSize: 14.5, lineHeight: 1.6, color: 'var(--color-ink)' }}>
          {step.text}
        </p>

        {/* Frame */}
        {topic.scene && (
          <div
            style={{
              borderRadius: 14,
              border:       '1px solid var(--color-border)',
              overflow:     'hidden',
              marginBottom: isLastStep ? 20 : 0,
            }}
          >
            <FrameImage
              scene={topic.scene}
              highlight={topic.highlight}
              showHighlight
              dim
              label
              pulse={isActive}
            />
          </div>
        )}

        {/* Collapsible rows on last step only */}
        {isLastStep && (
          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: topic.scene ? 0 : 8 }}>
            {topic.detail && (
              <CollapsibleRow
                label="Where this lives"
                isActive={isActive}
              >
                <span style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>shown in the report</span>
                <br />
                {topic.detail}
              </CollapsibleRow>
            )}
            {topic.scopedNote && (
              <CollapsibleRow
                label="Scoped differently for another persona"
                icon={<Users size={13} strokeWidth={1.9} />}
                isActive={isActive}
              >
                {topic.scopedNote}
              </CollapsibleRow>
            )}
            {hasNote && (
              <CollapsibleRow
                label={topic.note!.kind === 'warning' ? 'Warning' : 'Tip'}
                icon={
                  topic.note!.kind === 'warning'
                    ? <TriangleAlert size={13} color="var(--color-waiting)" />
                    : <Info size={13} color="var(--color-accent)" />
                }
                isActive={isActive}
                last
              >
                {topic.note!.text}
              </CollapsibleRow>
            )}
          </div>
        )}

        {/* Source badge */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <SourceBadge system={topic.system} />
        </div>
      </div>
    )
  }, [steps, closingIdx, topic, handleRegenerate, onReport, regenerating])

  return (
    <div style={{ width: '100%' }}>
      {/* Progress row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div className="track" style={{ flex: 1, height: 8 }}>
          <div
            className="track-fill"
            style={{
              width:      `${progressPct}%`,
              height:     '100%',
              transition: 'width 300ms ease-out',
            }}
          />
        </div>
        {activeIdx < steps.length && (
          <span
            style={{
              fontSize:       11,
              fontWeight:     500,
              color:          'var(--color-ink-muted)',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace:     'nowrap',
              flexShrink:     0,
            }}
          >
            Step {activeIdx + 1} / {steps.length}
          </span>
        )}
      </div>

      {/* Carousel */}
      <PeekCarousel
        count={slideCount}
        active={activeIdx}
        onChange={setActiveIdx}
        renderSlide={renderSlide}
        slideLabel={i =>
          i === closingIdx
            ? 'Summary and actions'
            : `Step ${i + 1} of ${steps.length}: ${steps[i]!.title}`
        }
        announce={i =>
          i === closingIdx
            ? 'Summary and actions'
            : `Step ${i + 1} of ${steps.length}: ${steps[i]!.title}`
        }
        ariaLabel={`Answer: ${topic.title}`}
        dots
        dotLabel={i =>
          i === closingIdx ? 'Go to summary' : `Go to step ${i + 1}`
        }
      />

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
