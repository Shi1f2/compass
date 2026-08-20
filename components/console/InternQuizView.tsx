/**
 * components/console/InternQuizView.tsx
 *
 * Intern-facing quiz answering view.
 *
 * Layout:
 *  - List view: cards for each assigned quiz (status badge, click to open)
 *  - Detail view: one question at a time (previous / next navigation),
 *    auto-save on every answer change, Submit button on the last question.
 *
 * Reads  — browser client, RLS-scoped to intern's own assignments/answers.
 * Writes — saveAnswer / submitQuiz server actions (intern-only, ownership-checked).
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { saveAnswer, submitQuiz } from '@/lib/intern-quiz-actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssignedQuiz {
  id:           string   // assignment id
  status:       string
  assigned_at:  string
  completed_at: string | null
  quiz: {
    id:   string
    name: string
    description: string
  }
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

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  assigned:    { label: 'Not started', bg: 'var(--color-sunk)',         color: 'var(--color-ink-muted)' },
  in_progress: { label: 'In progress', bg: 'var(--color-yellow-soft)',  color: 'var(--color-waiting)'   },
  submitted:   { label: 'Submitted',   bg: 'var(--color-correct-soft)', color: 'var(--color-correct)'   },
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

// ─── Detail view (answering one quiz) ─────────────────────────────────────────

function QuizDetail({
  assignment,
  onBack,
}: {
  assignment: AssignedQuiz
  onBack:     () => void
}) {
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
  const [submitted,   setSubmitted]   = useState(assignment.status === 'submitted')

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

  // ── Auto-save ─────────────────────────────────────────────────────────────
  // Debounced for open text; immediate for MC.

  const openSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persistAnswer = useCallback(async (
    questionId:     string,
    selectedOption: number | null,
    textAnswer:     string | null,
  ) => {
    setSaving(true)
    setSaveError(null)
    const { error } = await saveAnswer(assignment.id, questionId, selectedOption, textAnswer)
    setSaving(false)
    if (error) setSaveError(error)
  }, [assignment.id])

  function handleMcChoice(questionId: string, optionIdx: number) {
    if (submitted) return
    setAnswers(prev => {
      const next = new Map(prev)
      next.set(questionId, { question_id: questionId, selected_option: optionIdx, text_answer: null, score: null })
      return next
    })
    setSaveError(null)
    persistAnswer(questionId, optionIdx, null)
  }

  function handleOpenChange(questionId: string, text: string) {
    if (submitted) return
    setAnswers(prev => {
      const next = new Map(prev)
      next.set(questionId, { question_id: questionId, selected_option: null, text_answer: text, score: null })
      return next
    })
    setSaveError(null)
    if (openSaveTimer.current) clearTimeout(openSaveTimer.current)
    openSaveTimer.current = setTimeout(() => {
      persistAnswer(questionId, null, text)
    }, 800)
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    const { error } = await submitQuiz(assignment.id)
    setSubmitting(false)
    if (error) { setSubmitError(error); return }
    setSubmitted(true)
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
          <StatusBadge status={submitted ? 'submitted' : assignment.status} />
        </div>
        {assignment.quiz.description && (
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>
            {assignment.quiz.description}
          </p>
        )}
      </div>

      {/* Submitted state */}
      {submitted ? (
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <CheckCircle2
            size={36}
            style={{ color: 'var(--color-correct)', marginBottom: 12 }}
          />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 6 }}>
            Quiz submitted
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>
            Your answers have been recorded. Your supervisor will review them shortly.
          </div>
        </div>
      ) : (
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

              {question.kind === 'multiple_choice' && question.options ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {question.options.map((opt, i) => {
                    const isSelected = answer?.selected_option === i
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={submitted}
                        onClick={() => handleMcChoice(question.id, i)}
                        style={{
                          textAlign: 'left', padding: '12px 16px', borderRadius: 10,
                          border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          cursor: submitted ? 'default' : 'pointer',
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
              ) : (
                <textarea
                  value={answer?.text_answer ?? ''}
                  readOnly={submitted}
                  onChange={e => handleOpenChange(question.id, e.target.value)}
                  placeholder="Type your answer here…"
                  rows={6}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '12px 14px', borderRadius: 10,
                    border: '1px solid var(--color-border)',
                    background: submitted ? 'var(--color-sunk)' : 'var(--color-surface)',
                    fontSize: 13, color: 'var(--color-ink)',
                    fontFamily: 'var(--font-sans)', lineHeight: 1.6,
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              )}

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
      )}
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
  assignments: AssignedQuiz[]
  onSelect:    (a: AssignedQuiz) => void
}) {
  if (assignments.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', paddingTop: 24 }}>
        No quizzes assigned yet. Your supervisor will add them here.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 680 }}>
      {assignments.map(a => (
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
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InternQuizView() {
  const supabase = createClient()

  const [assignments, setAssignments] = useState<AssignedQuiz[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [selected,    setSelected]    = useState<AssignedQuiz | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: e } = await (supabase
      .from('quiz_assignments')
      .select('id, status, assigned_at, completed_at, quiz:quizzes(id, name, description)')
      .order('assigned_at', { ascending: true }) as unknown as
      Promise<{ data: AssignedQuiz[] | null; error: { message: string } | null }>)
    if (e) { setError(e.message); setLoading(false); return }
    setAssignments(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

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
    return <QuizDetail assignment={selected} onBack={handleBack} />
  }

  return <QuizList assignments={assignments} onSelect={setSelected} />
}
