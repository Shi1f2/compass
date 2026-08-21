/**
 * components/console/ScoringPanel.tsx
 *
 * Supervisor view for scoring a submitted quiz assignment and publishing the
 * review to the intern.
 *
 * Layout:
 *  - One question per card; all visible without pagination.
 *  - MC questions: show the intern's choice vs the correct answer, auto-score badge.
 *  - Open questions: show the intern's text answer, score input, Save per question.
 *  - Below the questions: overall feedback textarea + "Save and publish" button.
 *    The button is disabled while any open question is unscored.
 *  - After publishing the view stays readable; scores remain editable.
 *
 * Reads  — browser client, RLS-scoped to supervisor's supervisees.
 * Writes — scoreAnswer / publishAssignment server actions (supervisor-only).
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { publishAssignment, scoreAnswer } from '@/lib/quiz-actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionWithAnswer {
  // question fields
  questionId:    string
  kind:          string
  prompt:        string
  options:       string[] | null
  correctOption: number | null
  modelAnswer:   string | null
  orderIndex:    number
  // answer fields (may be absent if intern skipped)
  answerId:      string | null
  selectedOption: number | null
  textAnswer:    string | null
  score:         number | null
  scoredAt:      string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span style={{
        padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 500,
        background: 'var(--color-sunk)', color: 'var(--color-ink-muted)',
      }}>
        Not scored
      </span>
    )
  }
  const tone = score >= 80 ? 'correct' : score >= 50 ? 'yellow' : 'incorrect'
  const styles = {
    correct:   { bg: 'var(--color-correct-soft)',   color: 'var(--color-correct)'   },
    yellow:    { bg: 'var(--color-yellow-soft)',    color: 'var(--color-waiting)'   },
    incorrect: { bg: 'var(--color-incorrect-soft)', color: 'var(--color-incorrect)' },
  }[tone]
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 500,
      background: styles.bg, color: styles.color,
    }}>
      {score}/100
    </span>
  )
}

// ─── Open question scoring row ────────────────────────────────────────────────

function OpenScoreRow({
  row,
  onSaved,
}: {
  row:     QuestionWithAnswer
  onSaved: (answerId: string, newScore: number) => void
}) {
  const [draft,   setDraft]   = useState(row.score !== null ? String(row.score) : '')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [saved,   setSaved]   = useState(false)

  // Keep draft in sync when the parent reloads the row.
  useEffect(() => {
    setDraft(row.score !== null ? String(row.score) : '')
    setSaved(false)
  }, [row.score])

  async function handleSave() {
    if (!row.answerId) { setError('No answer to score.'); return }
    const n = parseInt(draft, 10)
    if (isNaN(n) || n < 0 || n > 100) { setError('Enter a whole number 0–100.'); return }
    setSaving(true)
    setError(null)
    const { error: e } = await scoreAnswer(row.answerId, n)
    setSaving(false)
    if (e) { setError(e); return }
    setSaved(true)
    onSaved(row.answerId, n)
  }

  const unchanged = draft === (row.score !== null ? String(row.score) : '')

  return (
    <div>
      {/* Intern's answer */}
      <div style={{
        padding: '12px 14px', borderRadius: 8, marginBottom: 12,
        background: 'var(--color-sunk)',
        fontSize: 13, color: 'var(--color-ink)', lineHeight: 1.6,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        minHeight: 48,
      }}>
        {row.textAnswer?.trim()
          ? row.textAnswer
          : <span style={{ color: 'var(--color-ink-muted)', fontStyle: 'italic' }}>No answer provided</span>
        }
      </div>

      {/* Model answer (collapsible via details) */}
      {row.modelAnswer?.trim() && (
        <details style={{ marginBottom: 12 }}>
          <summary style={{
            fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            cursor: 'pointer', userSelect: 'none', marginBottom: 4,
          }}>
            Model answer
          </summary>
          <div style={{
            padding: '10px 12px', borderRadius: 8,
            background: 'var(--color-accent-soft)',
            fontSize: 12, color: 'var(--color-ink)', lineHeight: 1.6,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {row.modelAnswer}
          </div>
        </details>
      )}

      {/* Score input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-ink-muted)', whiteSpace: 'nowrap' }}>
          Score (0–100)
        </label>
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={draft}
          onChange={e => { setDraft(e.target.value); setSaved(false); setError(null) }}
          style={{
            width: 72, padding: '6px 10px', borderRadius: 8, fontSize: 13,
            border: `1px solid ${error ? 'var(--color-incorrect)' : 'var(--color-border)'}`,
            background: 'var(--color-surface)', color: 'var(--color-ink)',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          disabled={saving || unchanged || !row.answerId}
          onClick={handleSave}
          style={{
            padding: '6px 16px', borderRadius: 9999, border: 'none',
            cursor: saving || unchanged || !row.answerId ? 'default' : 'pointer',
            fontSize: 12, fontWeight: 600,
            background: 'var(--color-accent)', color: '#fff',
            fontFamily: 'var(--font-sans)',
            opacity: saving || unchanged || !row.answerId ? 0.5 : 1,
            transition: 'opacity 150ms',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>

        {saved    && <span style={{ fontSize: 12, color: 'var(--color-correct)' }}>Saved</span>}
        {error    && <span style={{ fontSize: 12, color: 'var(--color-incorrect)' }}>{error}</span>}
      </div>
    </div>
  )
}

// ─── MC question result row ───────────────────────────────────────────────────

function McResultRow({ row }: { row: QuestionWithAnswer }) {
  const options = row.options ?? []
  const chosen  = row.selectedOption
  const correct = row.correctOption

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map((opt, i) => {
        const isChosen  = chosen === i
        const isCorrect = correct === i
        const highlight =
          isChosen && isCorrect ? 'correct' :
          isChosen && !isCorrect ? 'incorrect' :
          isCorrect ? 'correct-unselected' : 'neutral'

        const styles: Record<string, { border: string; bg: string; color: string }> = {
          correct:           { border: 'var(--color-correct)',   bg: 'var(--color-correct-soft)',   color: 'var(--color-correct)'   },
          incorrect:         { border: 'var(--color-incorrect)', bg: 'var(--color-incorrect-soft)', color: 'var(--color-incorrect)' },
          'correct-unselected': { border: 'var(--color-correct)', bg: 'transparent',                color: 'var(--color-correct)'   },
          neutral:           { border: 'var(--color-border)',    bg: 'transparent',                 color: 'var(--color-ink-muted)' },
        }
        const s = styles[highlight]!

        return (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8,
              border: `1.5px solid ${s.border}`,
              background: s.bg,
              fontSize: 13,
            }}
          >
            <span style={{ fontWeight: 500, color: s.color, minWidth: 20 }}>
              {String.fromCharCode(65 + i)}.
            </span>
            <span style={{ flex: 1, color: 'var(--color-ink)' }}>{opt}</span>
            {isChosen && isCorrect  && <CheckCircle2 size={14} style={{ color: 'var(--color-correct)',   flexShrink: 0 }} />}
            {isChosen && !isCorrect && <XCircle      size={14} style={{ color: 'var(--color-incorrect)', flexShrink: 0 }} />}
          </div>
        )
      })}

      {chosen === null && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-ink-muted)', fontStyle: 'italic' }}>
          No answer selected
        </p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ScoringPanelProps {
  /** The assignment id to score. */
  assignmentId:     string
  /** Quiz name — shown in the header. */
  quizName:         string
  /** Current status of the assignment. */
  initialStatus:    string
  /** Initial overall feedback (if already published). */
  initialFeedback:  string | null
  /** Called when the supervisor clicks the back button. */
  onBack:           () => void
}

export default function ScoringPanel({
  assignmentId,
  quizName,
  initialStatus,
  initialFeedback,
  onBack,
}: ScoringPanelProps) {
  const supabase = createClient()

  const [rows,       setRows]       = useState<QuestionWithAnswer[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [status,     setStatus]     = useState(initialStatus)
  const [feedback,   setFeedback]   = useState(initialFeedback ?? '')
  const [publishing, setPublishing] = useState(false)
  const [publishErr, setPublishErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: assignment } = await supabase
      .from('quiz_assignments')
      .select('quiz_id')
      .eq('id', assignmentId)
      .maybeSingle()

    if (!assignment) {
      setError('Assignment not found.')
      setLoading(false)
      return
    }

    const [qRes, aRes] = await Promise.all([
      supabase
        .from('quiz_questions')
        .select('id, kind, prompt, options, correct_option, model_answer, order_index')
        .eq('quiz_id', assignment.quiz_id)
        .order('order_index', { ascending: true }) as unknown as
        Promise<{ data: { id: string; kind: string; prompt: string; options: string[] | null; correct_option: number | null; model_answer: string | null; order_index: number }[] | null; error: { message: string } | null }>,
      supabase
        .from('quiz_answers')
        .select('id, question_id, selected_option, text_answer, score, scored_at')
        .eq('assignment_id', assignmentId) as unknown as
        Promise<{ data: { id: string; question_id: string; selected_option: number | null; text_answer: string | null; score: number | null; scored_at: string | null }[] | null; error: { message: string } | null }>,
    ])

    if (qRes.error) { setError(qRes.error.message); setLoading(false); return }
    if (aRes.error) { setError(aRes.error.message); setLoading(false); return }

    const answerMap = new Map((aRes.data ?? []).map(a => [a.question_id, a]))

    const combined: QuestionWithAnswer[] = (qRes.data ?? []).map(q => {
      const ans = answerMap.get(q.id)
      return {
        questionId:    q.id,
        kind:          q.kind,
        prompt:        q.prompt,
        options:       q.options,
        correctOption: q.correct_option,
        modelAnswer:   q.model_answer,
        orderIndex:    q.order_index,
        answerId:      ans?.id ?? null,
        selectedOption: ans?.selected_option ?? null,
        textAnswer:    ans?.text_answer ?? null,
        score:         ans?.score ?? null,
        scoredAt:      ans?.scored_at ?? null,
      }
    })

    setRows(combined)
    setLoading(false)
  }, [assignmentId, supabase])

  useEffect(() => { load() }, [load])

  function handleScoreSaved(answerId: string, newScore: number) {
    setRows(prev => prev.map(r =>
      r.answerId === answerId
        ? { ...r, score: newScore, scoredAt: new Date().toISOString() }
        : r
    ))
  }

  async function handlePublish() {
    setPublishing(true)
    setPublishErr(null)
    const { error: e } = await publishAssignment(assignmentId, feedback || null)
    setPublishing(false)
    if (e) { setPublishErr(e); return }
    setStatus('published')
  }

  // ── Summary stats ────────────────────────────────────────────────────────

  const openRows      = rows.filter(r => r.kind === 'open')
  const scoredOpen    = openRows.filter(r => r.score !== null).length
  const unscoredCount = openRows.length - scoredOpen
  const canPublish    = unscoredCount === 0 && status === 'submitted'
  const isPublished   = status === 'published'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 720 }}>

      {/* Back + header */}
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 0', border: 'none', background: 'none',
          cursor: 'pointer', fontSize: 13, fontWeight: 500,
          color: 'var(--color-ink-muted)', fontFamily: 'var(--font-sans)',
          marginBottom: 8,
        }}
      >
        <ArrowLeft size={15} /> Back to assignments
      </button>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{quizName}</h2>
          {isPublished && (
            <span style={{
              padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 500,
              background: 'var(--color-correct-soft)', color: 'var(--color-correct)',
            }}>
              Published
            </span>
          )}
        </div>
        {openRows.length > 0 && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-ink-muted)' }}>
            {unscoredCount === 0
              ? 'All open questions scored.'
              : `${scoredOpen} of ${openRows.length} open question${openRows.length !== 1 ? 's' : ''} scored.`
            }
          </p>
        )}
      </div>

      {loading && (
        <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>Loading…</p>
      )}
      {error && (
        <p style={{ fontSize: 13, color: 'var(--color-incorrect)' }}>{error}</p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>No questions found.</p>
      )}

      {/* Question cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {rows.map((row, idx) => (
          <div key={row.questionId} className="card" style={{ padding: 24 }}>

            {/* Question header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
                }}>
                  Q{idx + 1} &middot; {row.kind === 'multiple_choice' ? 'Multiple choice' : 'Open'}
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--color-ink)', lineHeight: 1.5 }}>
                  {row.prompt}
                </p>
              </div>
              <ScoreBadge score={row.score} />
            </div>

            {/* Answer area */}
            {row.kind === 'multiple_choice' ? (
              <McResultRow row={row} />
            ) : (
              <OpenScoreRow row={row} onSaved={handleScoreSaved} />
            )}
          </div>
        ))}
      </div>

      {/* Publish section — shown after questions load */}
      {!loading && !error && rows.length > 0 && (
        <div className="card" style={{ padding: 24, marginTop: 24 }}>
          <p style={{
            margin: '0 0 10px', fontSize: 12, fontWeight: 600,
            color: 'var(--color-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Overall feedback (optional)
          </p>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            readOnly={isPublished}
            placeholder="Write a short note for the intern about the quiz as a whole…"
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: isPublished ? 'var(--color-sunk)' : 'var(--color-surface)',
              fontSize: 13, color: 'var(--color-ink)',
              fontFamily: 'var(--font-sans)', lineHeight: 1.6,
              resize: 'vertical', outline: 'none',
              marginBottom: 14,
            }}
          />

          {isPublished ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-correct)', fontWeight: 500 }}>
              ✓ Review published — the intern can now see their results.
            </p>
          ) : (
            <div>
              {unscoredCount > 0 && (
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--color-ink-muted)' }}>
                  {unscoredCount} open question{unscoredCount !== 1 ? 's' : ''} still need{unscoredCount === 1 ? 's' : ''} scoring before you can publish.
                </p>
              )}
              {publishErr && (
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--color-incorrect)' }}>{publishErr}</p>
              )}
              <button
                type="button"
                disabled={!canPublish || publishing}
                onClick={handlePublish}
                title={canPublish ? undefined : 'Score all open questions first'}
                style={{
                  padding: '8px 20px', borderRadius: 9999, border: 'none',
                  cursor: !canPublish || publishing ? 'default' : 'pointer',
                  fontSize: 13, fontWeight: 600,
                  background: 'var(--color-accent)', color: '#fff',
                  fontFamily: 'var(--font-sans)',
                  opacity: !canPublish || publishing ? 0.45 : 1,
                  transition: 'opacity 150ms',
                }}
              >
                {publishing ? 'Publishing…' : 'Save and publish'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
