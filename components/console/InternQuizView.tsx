/**
 * components/console/InternQuizView.tsx
 *
 * Intern-facing quiz answering + results view.
 *
 * States per assignment:
 *  - assigned / in_progress  → answering flow (question-by-question)
 *  - submitted               → "Waiting for review" banner, read-only
 *  - published               → full result view (scores, model answers, feedback)
 *
 * Reads  — browser client, RLS-scoped to intern's own assignments/answers.
 *           Published results are read from the security-definer view
 *           intern_quiz_results (see migration 20250109000000_quiz_publish.sql).
 * Writes — saveAnswer / submitQuiz server actions (intern-only, ownership-checked).
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { saveAnswer, submitQuiz } from '@/lib/intern-quiz-actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssignedQuiz {
  id:           string   // assignment id
  status:       string
  assigned_at:  string
  completed_at: string | null
  // PostgREST returns null when the intern has no SELECT policy on quizzes.
  // The RLS policy is now in place, but we keep this nullable so that any
  // row that arrives with a null join (e.g. from a race or policy gap) is
  // filtered out rather than crashing.
  quiz: {
    id:          string
    name:        string
    description: string
  } | null
}

interface QuestionRow {
  id:             string
  kind:           string
  prompt:         string
  options:        string[] | null
  correct_option: number | null
  model_answer:   string | null
  order_index:    number
}

interface AnswerRow {
  question_id:     string
  selected_option: number | null
  text_answer:     string | null
  score:           number | null
}

// Rows returned by the security-definer view intern_quiz_results
interface PublishedResultRow {
  answer_id:         string
  assignment_id:     string
  overall_feedback:  string | null
  published_at:      string | null
  question_id:       string
  selected_option:   number | null
  text_answer:       string | null
  score:             number | null
  scored_at:         string | null
  kind:              string
  prompt:            string
  options:           string[] | null
  correct_option:    number | null
  model_answer:      string | null
  order_index:       number
  supervisor_comment: string | null
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  assigned:    { label: 'Not started',  bg: 'var(--color-sunk)',         color: 'var(--color-ink-muted)' },
  in_progress: { label: 'In progress',  bg: 'var(--color-yellow-soft)',  color: 'var(--color-waiting)'   },
  submitted:   { label: 'Submitted',    bg: 'var(--color-yellow-soft)',  color: 'var(--color-waiting)'   },
  published:   { label: 'Reviewed',     bg: 'var(--color-correct-soft)', color: 'var(--color-correct)'   },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES['assigned']!
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 500,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

// ─── Question progress dots ────────────────────────────────────────────────────

function ProgressDots({
  total, current, answers,
}: {
  total:   number
  current: number
  answers: Map<string, AnswerRow>
  questionIds: string[]
}) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => {
        const isActive  = i === current
        const isAnswered = false // dots are purely positional here
        void isAnswered
        return (
          <div
            key={i}
            style={{
              width: isActive ? 10 : 7, height: isActive ? 10 : 7,
              borderRadius: '50%',
              flexShrink: 0,
              background: isActive
                ? 'var(--color-accent)'
                : 'var(--color-border)',
              transition: 'all 150ms',
            }}
          />
        )
      })}
      <span style={{ fontSize: 11, color: 'var(--color-ink-muted)', marginLeft: 4 }}>
        {current + 1} / {total}
      </span>
    </div>
  )
}

// ─── Score bar (0-100) ────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return null
  const color = score >= 80 ? 'var(--color-correct)' : score >= 50 ? 'var(--color-waiting)' : 'var(--color-incorrect)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 9999, background: 'var(--color-sunk)', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 9999, transition: 'width 300ms' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 36, textAlign: 'right' }}>
        {score}/100
      </span>
    </div>
  )
}

// ─── Published result — single question card ─────────────────────────────────

function PublishedQuestionCard({ row, idx }: { row: PublishedResultRow; idx: number }) {
  const options = row.options ?? []

  return (
    <div className="card" style={{ padding: 24 }}>
      {/* Header */}
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
      }}>
        Q{idx + 1} &middot; Multiple choice
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 500, color: 'var(--color-ink)', lineHeight: 1.5 }}>
        {row.prompt}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        {options.map((opt, i) => {
          const isChosen  = row.selected_option === i
          const isCorrect = row.correct_option  === i
          const highlight =
            isChosen && isCorrect  ? 'correct' :
            isChosen && !isCorrect ? 'incorrect' :
            isCorrect              ? 'correct-unselected' : 'neutral'
          const styleMap: Record<string, { border: string; bg: string; color: string }> = {
            correct:              { border: 'var(--color-correct)',   bg: 'var(--color-correct-soft)',   color: 'var(--color-correct)'   },
            incorrect:            { border: 'var(--color-incorrect)', bg: 'var(--color-incorrect-soft)', color: 'var(--color-incorrect)' },
            'correct-unselected': { border: 'var(--color-correct)',   bg: 'transparent',                 color: 'var(--color-correct)'   },
            neutral:              { border: 'var(--color-border)',    bg: 'transparent',                 color: 'var(--color-ink-muted)' },
          }
          const s = styleMap[highlight]!
          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8,
                border: `1.5px solid ${s.border}`,
                background: s.bg, fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 500, color: s.color, minWidth: 20 }}>
                {String.fromCharCode(65 + i)}.
              </span>
              <span style={{ flex: 1, color: 'var(--color-ink)' }}>{opt}</span>
              </div>
          )
        })}
        {row.selected_option === null && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-ink-muted)', fontStyle: 'italic' }}>No answer selected</p>
        )}
      </div>

      {/* Score */}
      {row.score !== null && (
        <div style={{ marginTop: 6 }}>
          <ScoreBar score={row.score} />
        </div>
      )}

      {/* Supervisor comment */}
      {row.supervisor_comment?.trim() && (
        <div style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 8,
          background: 'var(--color-accent-soft)',
          fontSize: 12, color: 'var(--color-ink)', lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          <span style={{
            display: 'block', fontSize: 10, fontWeight: 600,
            color: 'var(--color-ink-muted)', textTransform: 'uppercase',
            letterSpacing: '0.08em', marginBottom: 4,
          }}>
            Supervisor note
          </span>
          {row.supervisor_comment}
        </div>
      )}
    </div>
  )
}

// ─── Published result view ────────────────────────────────────────────────────

function PublishedResultView({
  assignment,
  onBack,
}: {
  assignment: AssignedQuizWithQuiz
  onBack:     () => void
}) {
  const supabase = createClient()

  const [rows,      setRows]      = useState<PublishedResultRow[]>([])
  const [feedback,  setFeedback]  = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)

      const { data, error } = await (supabase
        .from('intern_quiz_results')
        .select('*')
        .eq('assignment_id', assignment.id)
        .order('order_index', { ascending: true }) as unknown as
        Promise<{ data: PublishedResultRow[] | null; error: { message: string } | null }>)

      if (cancelled) return
      if (error) { setLoadError(error.message); setLoading(false); return }

      const resultRows = data ?? []
      setRows(resultRows)
      setFeedback(resultRows[0]?.overall_feedback ?? null)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [assignment.id, supabase])

  // Total score — mean of all scored questions
  const scoredRows  = rows.filter(r => r.score !== null)
  const totalScore  = scoredRows.length > 0
    ? Math.round(scoredRows.reduce((s, r) => s + (r.score ?? 0), 0) / scoredRows.length)
    : null

  return (
    <div style={{ maxWidth: 680 }}>
      <BackButton onBack={onBack} />

      <div style={{ marginTop: 8, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--color-ink)' }}>
            {assignment.quiz.name}
          </h2>
          <StatusBadge status="published" />
        </div>
        {assignment.quiz.description && (
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>
            {assignment.quiz.description}
          </p>
        )}
      </div>

      {loading && (
        <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>Loading results…</p>
      )}
      {loadError && (
        <p style={{ fontSize: 13, color: 'var(--color-incorrect)' }}>{loadError}</p>
      )}

      {!loading && !loadError && (
        <>
          {/* Total score card */}
          {totalScore !== null && (
            <div className="card" style={{ padding: 20, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
                }}>
                  Total score
                </div>
                <ScoreBar score={totalScore} />
              </div>
              <div style={{
                fontSize: 28, fontWeight: 700,
                color: totalScore >= 80 ? 'var(--color-correct)' : totalScore >= 50 ? 'var(--color-waiting)' : 'var(--color-incorrect)',
              }}>
                {totalScore}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--color-ink-muted)' }}>/100</span>
              </div>
            </div>
          )}

          {/* Per-question results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            {rows.map((row, idx) => (
              <PublishedQuestionCard key={row.question_id} row={row} idx={idx} />
            ))}
          </div>

          {/* Overall feedback */}
          {feedback?.trim() && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
              }}>
                Supervisor&apos;s feedback
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {feedback}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Detail view (answering one quiz) ─────────────────────────────────────────

// QuizDetail only receives assignments that passed the null-quiz filter in load(),
// so quiz is guaranteed non-null here.  The prop type encodes that fact so the
// compiler can verify all five access sites without non-null assertions.
type AssignedQuizWithQuiz = AssignedQuiz & { quiz: NonNullable<AssignedQuiz['quiz']> }

function QuizDetail({
  assignment,
  onBack,
}: {
  assignment: AssignedQuizWithQuiz
  onBack:     () => void
}) {
  const router   = useRouter()
  const supabase = createClient()

  const [questions,   setQuestions]   = useState<QuestionRow[]>([])
  const [answers,     setAnswers]     = useState<Map<string, AnswerRow>>(new Map())
  const [currentIdx,  setCurrentIdx]  = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState<string | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState<string | null>(null)
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Load questions + existing answers ──────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)

      const [qRes, aRes] = await Promise.all([
        (supabase
          .from('quiz_questions')
          .select('id, kind, prompt, options, correct_option, model_answer, order_index')
          .eq('quiz_id', assignment.quiz.id)
          .order('order_index', { ascending: true }) as unknown as
          Promise<{ data: QuestionRow[] | null; error: { message: string } | null }>),
        (supabase
          .from('quiz_answers')
          .select('question_id, selected_option, text_answer, score')
          .eq('assignment_id', assignment.id) as unknown as
          Promise<{ data: AnswerRow[] | null; error: { message: string } | null }>),
      ])

      if (cancelled) return

      if (qRes.error) { setLoadError(qRes.error.message); setLoading(false); return }
      if (aRes.error) { setLoadError(aRes.error.message); setLoading(false); return }

      setQuestions(qRes.data ?? [])
      const map = new Map<string, AnswerRow>()
      for (const a of aRes.data ?? []) map.set(a.question_id, a)
      setAnswers(map)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [assignment.id, assignment.quiz.id, supabase])

  // ── Auto-save (MC only) ───────────────────────────────────────────────────

  const persistAnswer = useCallback(async (
    questionId:     string,
    selectedOption: number | null,
  ) => {
    setSaving(true)
    setSaveError(null)
    const { error } = await saveAnswer(assignment.id, questionId, selectedOption, null)
    setSaving(false)
    if (error) setSaveError(error)
  }, [assignment.id])

  function handleMcChoice(questionId: string, optionIdx: number) {
    setAnswers(prev => {
      const next = new Map(prev)
      next.set(questionId, { question_id: questionId, selected_option: optionIdx, text_answer: null, score: null })
      return next
    })
    setSaveError(null)
    persistAnswer(questionId, optionIdx)
  }

  // ── Submit (auto-publish) ─────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    const { error } = await submitQuiz(assignment.id)
    setSubmitting(false)
    if (error) { setSubmitError(error); return }
    // submitQuiz sets status='published' immediately. Navigate back so the
    // parent reloads the assignment list; the published status will route the
    // intern straight to PublishedResultView on re-select.
    // router.refresh() triggers a Next.js RSC re-render so the server-computed
    // progressPct (revalidated by the action) flows back to the header bar.
    router.refresh()
    onBack()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const question = questions[currentIdx]
  const answer   = question ? answers.get(question.id) : undefined
  const isLast   = currentIdx === questions.length - 1
  const isFirst  = currentIdx === 0
  if (loading) {
    return <p style={{ padding: '32px 0', fontSize: 13, color: 'var(--color-ink-muted)' }}>Loading…</p>
  }

  if (loadError) {
    return <p style={{ padding: '32px 0', fontSize: 13, color: 'var(--color-incorrect)' }}>{loadError}</p>
  }

  if (questions.length === 0) {
    return (
      <div>
        <BackButton onBack={onBack} />
        <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 24 }}>
          This quiz has no questions yet.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680 }}>

      {/* Back + quiz title */}
      <BackButton onBack={onBack} />

      <div style={{ marginTop: 8, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--color-ink)' }}>
            {assignment.quiz.name}
          </h2>
          <StatusBadge status={assignment.status} />
        </div>
        {assignment.quiz.description && (
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>
            {assignment.quiz.description}
          </p>
        )}
      </div>

      <>
        {/* Progress */}
        <div style={{ marginBottom: 20 }}>
          <ProgressDots
            total={questions.length}
            current={currentIdx}
            answers={answers}
            questionIds={questions.map(q => q.id)}
          />
        </div>

        {/* Question card */}
        {question && (
          <div className="card" style={{ padding: 28, marginBottom: 16 }}>
            <p style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 500, color: 'var(--color-ink)', lineHeight: 1.5 }}>
              {question.prompt}
            </p>

            {question.options ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {question.options.map((opt, i) => {
                  const isSelected = answer?.selected_option === i
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleMcChoice(question.id, i)}
                      style={{
                        textAlign: 'left', padding: '12px 16px', borderRadius: 10,
                        border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        cursor: 'pointer',
                        background: isSelected ? 'var(--color-accent-soft)' : 'var(--color-surface)',
                        fontSize: 13, color: 'var(--color-ink)',
                        fontFamily: 'var(--font-sans)',
                        transition: 'border-color 120ms, background 120ms',
                      }}
                    >
                      <span style={{ fontWeight: 500, marginRight: 10, color: 'var(--color-ink-muted)' }}>
                        {String.fromCharCode(65 + i)}.
                      </span>
                      {opt}
                    </button>
                  )
                })}
              </div>
            ) : null}

            {/* Save feedback */}
            <div style={{ marginTop: 12, minHeight: 18, fontSize: 12 }}>
              {saving    && <span style={{ color: 'var(--color-ink-muted)' }}>Saving…</span>}
              {saveError && <span style={{ color: 'var(--color-incorrect)' }}>{saveError}</span>}
            </div>
          </div>
        )}

        {/* Navigation + submit */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button
            type="button"
            disabled={isFirst}
            onClick={() => setCurrentIdx(i => i - 1)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, opacity: isFirst ? 0.4 : 1 }}
          >
            <ChevronLeft size={14} /> Previous
          </button>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {submitError && (
              <span style={{ fontSize: 12, color: 'var(--color-incorrect)' }}>{submitError}</span>
            )}

            {isLast ? (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 20px', borderRadius: 9999,
                  border: 'none', cursor: submitting ? 'default' : 'pointer',
                  fontSize: 13, fontWeight: 600,
                  background: 'var(--color-accent)', color: '#fff',
                  fontFamily: 'var(--font-sans)',
                  opacity: submitting ? 0.7 : 1,
                  transition: 'opacity 150ms',
                }}
              >
                {submitting ? 'Submitting…' : 'Submit quiz'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentIdx(i => i + 1)}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              >
                Next <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </>
    </div>
  )
}

// ─── Small shared back button ─────────────────────────────────────────────────

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 0', border: 'none', background: 'none',
        cursor: 'pointer', fontSize: 13, fontWeight: 500,
        color: 'var(--color-ink-muted)', fontFamily: 'var(--font-sans)',
      }}
    >
      <ArrowLeft size={15} /> All quizzes
    </button>
  )
}

// ─── List view (assignment cards) ─────────────────────────────────────────────

function QuizList({
  assignments,
  onSelect,
}: {
  assignments: AssignedQuizWithQuiz[]
  onSelect:    (a: AssignedQuizWithQuiz) => void
}) {
  if (assignments.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', paddingTop: 24 }}>
        No quizzes assigned yet. Your supervisor will add them here.
      </p>
    )
  }

  // Split into active (not yet reviewed) and finished (published)
  const active   = assignments.filter(a => a.status !== 'published')
  const finished = assignments.filter(a => a.status === 'published')

  function renderCard(a: AssignedQuizWithQuiz) {
    return (
      <button
        key={a.id}
        type="button"
        onClick={() => onSelect(a)}
        style={{
          textAlign: 'left', padding: 0, border: 'none',
          background: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div
          className="card"
          style={{
            padding: '18px 20px',
            display: 'flex', alignItems: 'center', gap: 16,
            transition: 'box-shadow 150ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-accent)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 4 }}>
              {a.quiz.name}
            </div>
            {a.quiz.description && (
              <div style={{
                fontSize: 12, color: 'var(--color-ink-muted)', lineHeight: 1.4,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {a.quiz.description}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--color-ink-muted)', marginTop: 6 }}>
              Assigned {new Date(a.assigned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              {a.completed_at && (
                <> &middot; Submitted {new Date(a.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>
              )}
            </div>
          </div>
          <StatusBadge status={a.status} />
        </div>
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 680 }}>
      {active.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {active.map(renderCard)}
        </div>
      )}

      {finished.length > 0 && (
        <div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: 10,
          }}>
            Finished
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {finished.map(renderCard)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

// ─── Props ────────────────────────────────────────────────────────────────────

interface InternQuizViewProps {
  /**
   * Called whenever the "in-progress unsubmitted quiz is open" state changes.
   * true  = intern is actively answering an unsubmitted quiz
   * false = list view, submitted view, or published result view
   */
  onActiveQuizChange?: (active: boolean) => void
}

export default function InternQuizView({ onActiveQuizChange }: InternQuizViewProps = {}) {
  const supabase = createClient()

  const [assignments, setAssignments] = useState<AssignedQuizWithQuiz[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [selected,    setSelected]    = useState<AssignedQuizWithQuiz | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: e } = await (supabase
      .from('quiz_assignments')
      .select('id, status, assigned_at, completed_at, quiz:quizzes(id, name, description)')
      .order('assigned_at', { ascending: true }) as unknown as
      Promise<{ data: AssignedQuiz[] | null; error: { message: string } | null }>)
    if (e) { setError(e.message); setLoading(false); return }
    // Drop any row where the quiz join came back null — this would only happen
    // if the RLS policy is missing or the quiz was deleted after assignment.
    setAssignments((data ?? []).filter((a): a is AssignedQuizWithQuiz => a.quiz !== null))
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // Notify the parent whenever the active-quiz state changes.
  useEffect(() => {
    const isActive = selected !== null
      && selected.status !== 'submitted'
      && selected.status !== 'published'
    onActiveQuizChange?.(isActive)
  }, [selected, onActiveQuizChange])

  // When returning from a detail, refresh the list so statuses are current.
  function handleBack() {
    setSelected(null)
    load()
  }

  if (loading) {
    return <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', padding: '24px 0' }}>Loading quizzes…</p>
  }

  if (error) {
    return <p style={{ fontSize: 13, color: 'var(--color-incorrect)', padding: '24px 0' }}>{error}</p>
  }

  if (selected) {
    if (selected.status === 'published') {
      return <PublishedResultView assignment={selected} onBack={handleBack} />
    }
    return <QuizDetail assignment={selected} onBack={handleBack} />
  }

  return <QuizList assignments={assignments} onSelect={setSelected} />
}
