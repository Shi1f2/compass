/**
 * components/console/ScoringPanel.tsx
 *
 * Supervisor view for reviewing a submitted/published quiz assignment.
 *
 * Layout:
 *  - One question per card; all visible without pagination.
 *  - Each MC question shows: intern's choice vs. correct answer, auto-score (read-only).
 *  - Optional per-question comment textarea (supervisor_comment).
 *  - Below the questions: overall feedback textarea + "Save feedback" button.
 *    The button is enabled immediately — no scoring prerequisite.
 *
 * Reads  — browser client, RLS-scoped to supervisor's supervisees.
 * Writes — saveFeedback / saveAnswerComment server actions (supervisor-only).
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { saveFeedback, saveAnswerComment } from '@/lib/quiz-actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionWithAnswer {
  // question fields
  questionId:    string
  kind:          string
  prompt:        string
  options:       string[] | null
  correctOption: number | null
  orderIndex:    number
  // answer fields (may be absent if intern skipped)
  answerId:      string | null
  selectedOption: number | null
  score:         number | null
  scoredAt:      string | null
  supervisorComment: string | null
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

// ─── Per-question comment row ─────────────────────────────────────────────────

function CommentRow({
  answerId,
  initialComment,
}: {
  answerId: string | null
  initialComment: string | null
}) {
  const [draft,  setDraft]  = useState(initialComment ?? '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  if (!answerId) return null

  const unchanged = draft === (initialComment ?? '')

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { error: e } = await saveAnswerComment(answerId!, draft.trim() || null)
    setSaving(false)
    if (e) { setError(e); return }
    setSaved(true)
  }

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
      <label style={{
        fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        display: 'block', marginBottom: 6,
      }}>
        Note for intern (optional)
      </label>
      <textarea
        value={draft}
        onChange={e => { setDraft(e.target.value); setSaved(false); setError(null) }}
        placeholder="Add a note about this question for the intern…"
        rows={2}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '8px 10px', borderRadius: 8,
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)', color: 'var(--color-ink)',
          fontFamily: 'var(--font-sans)', fontSize: 12, lineHeight: 1.5,
          resize: 'vertical', outline: 'none',
          marginBottom: 8,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          disabled={saving || unchanged}
          onClick={handleSave}
          style={{
            padding: '5px 14px', borderRadius: 9999, border: 'none',
            cursor: saving || unchanged ? 'default' : 'pointer',
            fontSize: 11, fontWeight: 600,
            background: 'var(--color-accent)', color: '#fff',
            fontFamily: 'var(--font-sans)',
            opacity: saving || unchanged ? 0.5 : 1,
            transition: 'opacity 150ms',
          }}
        >
          {saving ? 'Saving…' : 'Save note'}
        </button>
        {saved  && <span style={{ fontSize: 11, color: 'var(--color-correct)' }}>Saved</span>}
        {error  && <span style={{ fontSize: 11, color: 'var(--color-incorrect)' }}>{error}</span>}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ScoringPanelProps {
  /** The assignment id to review. */
  assignmentId:     string
  /** Quiz name — shown in the header. */
  quizName:         string
  /** Current status of the assignment. */
  initialStatus:    string
  /** Initial overall feedback (if already saved). */
  initialFeedback:  string | null
  /** Called when the supervisor clicks the back button. */
  onBack:           () => void
}

export default function ScoringPanel({
  assignmentId,
  quizName,
  initialFeedback,
  onBack,
}: ScoringPanelProps) {
  const supabase = createClient()

  const [rows,      setRows]      = useState<QuestionWithAnswer[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [feedback,  setFeedback]  = useState(initialFeedback ?? '')
  const [saving,    setSaving]    = useState(false)
  const [saveErr,   setSaveErr]   = useState<string | null>(null)
  const [saved,     setSaved]     = useState(false)

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
        .select('id, kind, prompt, options, correct_option, order_index')
        .eq('quiz_id', assignment.quiz_id)
        .order('order_index', { ascending: true }) as unknown as
        Promise<{ data: { id: string; kind: string; prompt: string; options: string[] | null; correct_option: number | null; order_index: number }[] | null; error: { message: string } | null }>,
      supabase
        .from('quiz_answers')
        .select('id, question_id, selected_option, score, scored_at, supervisor_comment')
        .eq('assignment_id', assignmentId) as unknown as
        Promise<{ data: { id: string; question_id: string; selected_option: number | null; score: number | null; scored_at: string | null; supervisor_comment: string | null }[] | null; error: { message: string } | null }>,
    ])

    if (qRes.error) { setError(qRes.error.message); setLoading(false); return }
    if (aRes.error) { setError(aRes.error.message); setLoading(false); return }

    const answerMap = new Map((aRes.data ?? []).map(a => [a.question_id, a]))

    const combined: QuestionWithAnswer[] = (qRes.data ?? []).map(q => {
      const ans = answerMap.get(q.id)
      return {
        questionId:        q.id,
        kind:              q.kind,
        prompt:            q.prompt,
        options:           q.options,
        correctOption:     q.correct_option,
        orderIndex:        q.order_index,
        answerId:          ans?.id ?? null,
        selectedOption:    ans?.selected_option ?? null,
        score:             ans?.score ?? null,
        scoredAt:          ans?.scored_at ?? null,
        supervisorComment: ans?.supervisor_comment ?? null,
      }
    })

    setRows(combined)
    setLoading(false)
  }, [assignmentId, supabase])

  useEffect(() => { load() }, [load])

  async function handleSaveFeedback() {
    setSaving(true)
    setSaveErr(null)
    setSaved(false)
    const { error: e } = await saveFeedback(assignmentId, feedback || null)
    setSaving(false)
    if (e) { setSaveErr(e); return }
    setSaved(true)
  }

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
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{quizName}</h2>
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
                  Q{idx + 1} &middot; Multiple choice
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--color-ink)', lineHeight: 1.5 }}>
                  {row.prompt}
                </p>
              </div>
              <ScoreBadge score={row.score} />
            </div>

            {/* Answer area — read-only MC */}
            <McResultRow row={row} />

            {/* Per-question supervisor comment */}
            <CommentRow answerId={row.answerId} initialComment={row.supervisorComment} />
          </div>
        ))}
      </div>

      {/* Overall feedback section */}
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
            onChange={e => { setFeedback(e.target.value); setSaved(false) }}
            placeholder="Write a short note for the intern about the quiz as a whole…"
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              fontSize: 13, color: 'var(--color-ink)',
              fontFamily: 'var(--font-sans)', lineHeight: 1.6,
              resize: 'vertical', outline: 'none',
              marginBottom: 14,
            }}
          />

          {saveErr && (
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--color-incorrect)' }}>{saveErr}</p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveFeedback}
              style={{
                padding: '8px 20px', borderRadius: 9999, border: 'none',
                cursor: saving ? 'default' : 'pointer',
                fontSize: 13, fontWeight: 600,
                background: 'var(--color-accent)', color: '#fff',
                fontFamily: 'var(--font-sans)',
                opacity: saving ? 0.45 : 1,
                transition: 'opacity 150ms',
              }}
            >
              {saving ? 'Saving…' : 'Save feedback'}
            </button>
            {saved && (
              <span style={{ fontSize: 12, color: 'var(--color-correct)' }}>
                ✓ Feedback saved — the intern can see it now.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
