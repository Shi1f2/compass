/**
 * components/console/TutorQuestionView.tsx
 * Right panel of the Tutor tab.
 *
 * Design decision: colour — plus an icon and text label, so it is never colour
 * alone — carries the result. The result should read in the first second, not
 * after skimming a form.
 */
'use client'

import {
  useCallback, useEffect, useRef, useState,
} from 'react'
import {
  Check, ChevronDown, GraduationCap, Info, RefreshCw, TriangleAlert, X,
} from 'lucide-react'
import type { TutorDispatch } from '@/lib/consoleState'
import type { QuizDay } from '@/lib/quizGroup'
import { NOT_ATTEMPTED, firstUnanswered } from '@/lib/quizGroup'
import type { Question, NoteKind } from '@/lib/types'
import PeekCarousel from './PeekCarousel'

const PASS = 80

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ResultDisc({
  correct, size = 24,
}: { correct: boolean; size?: number }) {
  const bg    = correct ? 'var(--color-correct)' : 'var(--color-incorrect)'
  const Icon  = correct ? Check : X
  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon size={14} strokeWidth={3} color="#fff" />
    </div>
  )
}

// ─── Note control ─────────────────────────────────────────────────────────────

interface NoteControlProps {
  question: Question
  isActive: boolean
  dispatch: (a: TutorDispatch) => void
}

function NoteControl({ question, isActive, dispatch }: NoteControlProps) {
  const [open, setOpen]    = useState(false)
  const note = question.note

  useEffect(() => { if (!isActive) setOpen(false) }, [isActive])

  const kinds: NoteKind[] = ['none', 'tip', 'warning']
  const labels: Record<NoteKind, string> = { none: 'None', tip: 'Tip', warning: 'Warning' }
  const currentKind: NoteKind = note?.kind ?? 'none'

  function setKind(k: NoteKind) {
    dispatch({ type: 'PATCH', list: 'quiz', id: question.id, patch: { note: { kind: k, text: note?.text ?? '' } } })
  }
  function setText(text: string) {
    dispatch({ type: 'PATCH', list: 'quiz', id: question.id, patch: { note: { kind: currentKind, text } } })
  }

  return (
    <div>
      <button
        type="button"
        tabIndex={isActive ? 0 : -1}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: '1px solid var(--color-border)',
          borderRadius: 9999, padding: '4px 12px',
          fontSize: 12, fontWeight: 500, cursor: 'pointer',
          color: 'var(--color-ink-muted)', fontFamily: 'var(--font-sans)',
        }}
      >
        Note
        {currentKind !== 'none' && (
          <><span style={{ color: 'var(--color-border)' }}>&middot;</span>{labels[currentKind]}</>
        )}
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
      </button>

      {open && (
        <div className="animate-fade-up" style={{ marginTop: 12 }}>
          {/* Kind pills */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {kinds.map(k => (
              <button
                key={k} type="button"
                tabIndex={isActive ? 0 : -1}
                onClick={() => setKind(k)}
                style={{
                  padding: '4px 12px', borderRadius: 9999, border: 'none',
                  cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  background: currentKind === k ? 'var(--color-violet)' : 'var(--color-sunk)',
                  color:      currentKind === k ? '#fff'                : 'var(--color-ink-muted)',
                  fontFamily: 'var(--font-sans)',
                  transition: 'background 150ms, color 150ms',
                }}
              >
                {labels[k]}
              </button>
            ))}
          </div>

          {/* Text input */}
          {currentKind !== 'none' && (
            <div
              style={{
                borderRadius: 14, padding: 16,
                background: currentKind === 'warning' ? 'var(--color-yellow-soft)' : 'var(--color-violet-soft)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}
            >
              {currentKind === 'warning'
                ? <TriangleAlert size={14} color="var(--color-waiting)" style={{ flexShrink: 0, marginTop: 2 }} />
                : <Info          size={14} color="var(--color-accent)"  style={{ flexShrink: 0, marginTop: 2 }} />
              }
              <textarea
                rows={2}
                tabIndex={isActive ? 0 : -1}
                value={note?.text ?? ''}
                onChange={e => setText(e.target.value)}
                placeholder={currentKind === 'warning' ? 'What could go wrong here?' : 'A short piece of advice.'}
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  outline: 'none', fontSize: 13, lineHeight: 1.6,
                  color: 'var(--color-ink)', fontFamily: 'var(--font-sans)',
                  resize: 'none',
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Question card ────────────────────────────────────────────────────────────

interface QuestionCardProps {
  question:  Question
  isActive:  boolean
  dispatch:  (a: TutorDispatch) => void
}

function QuestionCard({ question, isActive, dispatch }: QuestionCardProps) {
  const [rephrasing, setRephrasing] = useState(false)
  const result = question.result
  const attempted = result && result.attemptedAt !== NOT_ATTEMPTED

  useEffect(() => { if (!isActive) setRephrasing(false) }, [isActive])

  function handleRephrase() {
    setRephrasing(true)
    setTimeout(() => {
      dispatch({ type: 'REGENERATE', list: 'quiz', id: question.id })
      setRephrasing(false)
    }, 700)
  }

  const isWritten = question.kind === 'written'

  return (
    <div className="card" style={{ padding: 32, width: '100%' }}>
      {/* Prompt */}
      <h3 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 600, lineHeight: 1.2, color: 'var(--color-ink)' }}>
        {question.prompt}
      </h3>

      {/* Body */}
      {isWritten ? (
        <WrittenBody question={question} isActive={isActive} />
      ) : (
        <ChoiceBody question={question} isActive={isActive} />
      )}

      {/* Metadata */}
      {attempted && result && (
        <p style={{ margin: '16px 0 0', fontSize: 11, color: 'var(--color-ink-muted)' }}>
          Attempted {result.attemptedAt} &middot; pass &ge; {result.passThreshold}%&nbsp;
          <strong style={{ color: result.score >= result.passThreshold ? 'var(--color-correct)' : 'var(--color-incorrect)' }}>
            {result.score >= result.passThreshold ? 'Pass' : 'Fail'}
          </strong>
        </p>
      )}

      {/* Action row */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          marginTop: 24,
          paddingTop: 20,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}
      >
        {!isWritten && (
          <button
            type="button"
            tabIndex={isActive ? 0 : -1}
            onClick={handleRephrase}
            disabled={rephrasing}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12 }}
          >
            <RefreshCw
              size={13}
              style={rephrasing ? { animation: 'spin 700ms linear infinite' } : undefined}
            />
            {rephrasing ? 'Rewriting…' : 'Rephrase'}
          </button>
        )}
        <NoteControl question={question} isActive={isActive} dispatch={dispatch} />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Choice body ──────────────────────────────────────────────────────────────

function ChoiceBody({ question, isActive }: { question: Question; isActive: boolean }) {
  const result   = question.result
  const chosen   = result?.chosenOptionId
  const attempted = result && result.attemptedAt !== NOT_ATTEMPTED

  return (
    <>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {question.options.map(opt => {
          const isCorrect = opt.id === question.correctOptionId
          const isChosen  = opt.id === chosen
          const isWrong   = isChosen && !isCorrect

          // Correctness is the one place in this UI where a filled row keeps a
          // matching border, because the tint alone is too quiet to carry a pass or fail.
          let bg      = 'var(--color-surface)'
          let border  = '1px solid var(--color-border)'
          if (attempted && isCorrect) {
            bg     = 'var(--color-correct-soft)'
            border = '1px solid color-mix(in srgb, var(--color-correct) 30%, transparent)'
          } else if (isWrong) {
            bg     = 'var(--color-incorrect-soft)'
            border = '1px solid color-mix(in srgb, var(--color-incorrect) 30%, transparent)'
          }

          return (
            <li
              key={opt.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                borderRadius: 14, border, background: bg,
                padding: '14px 16px', fontSize: 13,
              }}
            >
              {/* Leading disc */}
              {attempted && isCorrect ? (
                <ResultDisc correct={true} />
              ) : isWrong ? (
                <ResultDisc correct={false} />
              ) : (
                <div
                  aria-hidden="true"
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--color-sunk)', flexShrink: 0,
                  }}
                />
              )}

              {/* Text */}
              <span style={{ flex: 1 }}>{opt.text}</span>

              {/* Result pill */}
              {attempted && (isCorrect || isWrong) && (
                <span
                  className="pill"
                  style={{
                    background: isCorrect
                      ? 'color-mix(in srgb, var(--color-correct) 10%, transparent)'
                      : 'color-mix(in srgb, var(--color-incorrect) 10%, transparent)',
                    color: isCorrect ? 'var(--color-correct)' : 'var(--color-incorrect)',
                  }}
                >
                  {isCorrect ? 'Correct' : 'Incorrect'}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {/* Explanation */}
      {attempted && (
        <p style={{ margin: '16px 0 0', fontSize: 14.5, lineHeight: 1.6, color: 'var(--color-ink-muted)' }}>
          {question.explanation}
        </p>
      )}
    </>
  )
}

// ─── Written body ─────────────────────────────────────────────────────────────

function WrittenBody({ question, isActive }: { question: Question; isActive: boolean }) {
  const result   = question.result
  const attempted = result && result.attemptedAt !== NOT_ATTEMPTED
  const score    = attempted ? result!.score : null

  return (
    <>
      {/* Score ramp
          Numeric and positional at once — the result reads before any text does. */}
      <div
        role="img"
        aria-label={score !== null ? `Score: ${score} out of 100` : 'Not yet attempted'}
        style={{ marginBottom: 24, position: 'relative' }}
      >
        <div
          style={{
            height: 10, borderRadius: 9999,
            background: 'linear-gradient(to right, var(--color-incorrect), var(--color-waiting), var(--color-correct))',
            position: 'relative',
          }}
        >
          {score !== null && (
            <>
              {/* Score label floats above marker */}
              <span
                style={{
                  position: 'absolute',
                  left: `${score}%`,
                  transform: 'translateX(-50%)',
                  bottom: 18,
                  fontSize: 20,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--color-ink)',
                  whiteSpace: 'nowrap',
                }}
              >
                {score}
              </span>
              {/* Marker */}
              <div
                style={{
                  position: 'absolute',
                  left: `${score}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--color-ink)',
                  border: '3px solid var(--color-surface)',
                  boxShadow: 'var(--shadow-card)',
                }}
              />
            </>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--color-ink-muted)' }}>
          <span>0</span><span>100</span>
        </div>
      </div>

      {/* Answers grid */}
      {attempted && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginBottom: 16,
          }}
        >
          {[
            { label: 'Your answer', text: question.writtenAnswer },
            { label: 'Full-marks answer', text: question.modelAnswer },
          ].map(({ label, text }) => (
            <div key={label}>
              <span className="section-label" style={{ display: 'block', marginBottom: 8 }}>{label}</span>
              <p
                style={{
                  margin: 0,
                  borderRadius: 14,
                  background: 'var(--color-sunk)',
                  padding: 16,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: 'var(--color-ink)',
                }}
              >
                {text ?? '—'}
              </p>
            </div>
          ))}
        </div>
      )}

      {attempted && question.missedPoint && (
        <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-ink-muted)' }}>
          {question.missedPoint}
        </p>
      )}
    </>
  )
}

// ─── Day closing card ─────────────────────────────────────────────────────────

interface DayClosingCardProps {
  day:      QuizDay
  days:     QuizDay[]
  dispatch: (a: TutorDispatch) => void
}

function DayClosingCard({ day, days, dispatch }: DayClosingCardProps) {
  const scores    = day.questions.filter(q => q.result && q.result.attemptedAt !== NOT_ATTEMPTED).map(q => q.result!.score)
  const avg       = scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : 0
  const passes    = avg >= PASS
  const qNoun     = day.questions.length === 1 ? 'question' : 'questions'

  const dayIdx    = days.findIndex(d => d.day === day.day)
  const nextDay   = days[dayIdx + 1]
  const hasNext   = nextDay && !nextDay.locked

  const bgColor = passes ? 'var(--color-correct-soft)' : 'var(--color-incorrect-soft)'
  const fgColor = passes ? 'var(--color-correct)'      : 'var(--color-incorrect)'

  return (
    <div
      className="card"
      style={{
        minHeight: 260,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 36, gap: 12, width: '100%',
      }}
    >
      <span className="section-label">{day.topicLabel} complete</span>

      <div
        style={{
          width: 96, height: 96, borderRadius: '50%',
          background: bgColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: fgColor }}>
          {avg}%
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-muted)', textAlign: 'center' }}>
        <strong style={{ color: fgColor }}>{passes ? 'Passed' : 'Below pass threshold'}</strong>
        &nbsp;&middot; {day.questions.length} {qNoun}
      </p>

      {hasNext ? (
        <button
          type="button"
          className="btn-primary"
          style={{ width: '100%', maxWidth: 260 }}
          onClick={() => dispatch({ type: 'SELECT_DAY', day: nextDay.day })}
        >
          Start next topic
        </button>
      ) : nextDay ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-muted)', textAlign: 'center' }}>
          The next topic isn&rsquo;t unlocked yet.
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-muted)', textAlign: 'center' }}>
          That&rsquo;s every topic so far.
        </p>
      )}
    </div>
  )
}

// ─── Question view ────────────────────────────────────────────────────────────

interface TutorQuestionViewProps {
  day:               QuizDay
  days:              QuizDay[]
  selectedQuestionId: string
  dispatch:          (a: TutorDispatch) => void
}

export default function TutorQuestionView({
  day, days, selectedQuestionId, dispatch,
}: TutorQuestionViewProps) {
  const closingIdx = day.questions.length

  // Start at the first unanswered; reset when day changes
  const firstUnansweredIdx = day.questions.findIndex(q => !q.result || q.result.attemptedAt === NOT_ATTEMPTED)
  const startIdx = firstUnansweredIdx >= 0 ? firstUnansweredIdx : 0

  const [activeIdx, setActiveIdx] = useState(startIdx)
  const prevDayRef = useRef(day.day)

  useEffect(() => {
    if (day.day !== prevDayRef.current) {
      prevDayRef.current = day.day
      const unanswered = day.questions.findIndex(q => !q.result || q.result.attemptedAt === NOT_ATTEMPTED)
      setActiveIdx(unanswered >= 0 ? unanswered : 0)
    }
  }, [day])

  // Changing slide dispatches selection (when within questions)
  function handleChange(i: number) {
    setActiveIdx(i)
    if (i < closingIdx) {
      const q = day.questions[i]
      if (q) dispatch({ type: 'SELECT', list: 'quiz', id: q.id })
    }
  }

  const slideCount = day.questions.length + 1

  const renderSlide = useCallback((i: number, isActive: boolean) => {
    if (i === closingIdx) {
      return <DayClosingCard day={day} days={days} dispatch={dispatch} />
    }
    const q = day.questions[i]!
    return <QuestionCard question={q} isActive={isActive} dispatch={dispatch} />
  }, [day, days, dispatch, closingIdx])

  return (
    <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '36px 32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
          <span className="section-label">
            {day.topicLabel}
          </span>
          {activeIdx < closingIdx && (
            <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--color-ink-muted)', whiteSpace: 'nowrap' }}>
              Question {activeIdx + 1} of {day.questions.length}
            </span>
          )}
        </div>

        {/* Carousel — no dots */}
        <PeekCarousel
          count={slideCount}
          active={activeIdx}
          onChange={handleChange}
          renderSlide={renderSlide}
          slideLabel={i =>
            i === closingIdx
              ? `${day.topicLabel} summary`
              : `Question ${i + 1} of ${day.questions.length}`
          }
          announce={i => {
            if (i === closingIdx) return `${day.topicLabel} summary`
            const q = day.questions[i]!
            const res = q.result
            if (!res || res.attemptedAt === NOT_ATTEMPTED) return `Question ${i + 1} of ${day.questions.length}`
            const verdict = res.correct ? 'correct' : 'incorrect'
            return `Question ${i + 1} of ${day.questions.length} — ${verdict} — ${res.score}%`
          }}
          ariaLabel={day.topicLabel}
        />
      </div>
    </div>
  )
}
