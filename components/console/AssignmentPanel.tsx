/**
 * components/console/AssignmentPanel.tsx
 * Supervisor view of one intern's quiz assignments.
 * Shown in the 'quizzes' tab of DetailView.
 *
 * Reads:
 *   - intern's current assignments (with quiz name) — browser client, RLS-scoped
 *   - org quiz library (for the picker) — browser client, RLS-scoped
 * Writes:
 *   - assignQuiz / unassignQuiz server actions
 *
 * Clicking a submitted assignment opens ScoringPanel inline.
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClipboardCheck, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { assignQuiz, unassignQuiz } from '@/lib/quiz-actions'
import ScoringPanel from './ScoringPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssignmentRow {
  id:           string
  status:       string
  assigned_at:  string
  completed_at: string | null
  quiz: {
    id:   string
    name: string
  }
}

interface QuizOption {
  id:   string
  name: string
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
      background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AssignmentPanelProps {
  /** The intern whose assignments are shown. */
  profileId: string
}

export default function AssignmentPanel({ profileId }: AssignmentPanelProps) {
  const supabase = createClient()

  const [assignments,  setAssignments]  = useState<AssignmentRow[]>([])
  const [library,      setLibrary]      = useState<QuizOption[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  // Picker state
  const [pickerOpen,   setPickerOpen]   = useState(false)
  const [assigning,    setAssigning]    = useState<string | null>(null)   // quizId being assigned
  const [removingId,   setRemovingId]   = useState<string | null>(null)   // assignmentId being removed
  const [actionError,  setActionError]  = useState<string | null>(null)

  // Scoring state — non-null when the supervisor is reviewing a submitted quiz
  const [scoring, setScoring] = useState<{ assignmentId: string; quizName: string } | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const [aResult, qResult] = await Promise.all([
      // Assignments for this intern — join quiz name inline
      (supabase
        .from('quiz_assignments')
        .select('id, status, assigned_at, completed_at, quiz:quizzes(id, name)')
        .eq('profile_id', profileId)
        .order('assigned_at', { ascending: true }) as unknown as
        Promise<{ data: AssignmentRow[] | null; error: { message: string } | null }>),
      // Full quiz library (supervisor RLS scopes to own org)
      (supabase
        .from('quizzes')
        .select('id, name')
        .order('name', { ascending: true }) as unknown as
        Promise<{ data: QuizOption[] | null; error: { message: string } | null }>),
    ])

    if (aResult.error) { setError(aResult.error.message); setLoading(false); return }
    if (qResult.error) { setError(qResult.error.message); setLoading(false); return }

    setAssignments(aResult.data ?? [])
    setLibrary(qResult.data ?? [])
    setLoading(false)
  }, [profileId, supabase])

  useEffect(() => { load() }, [load])

  // ── Assign ────────────────────────────────────────────────────────────────

  async function handleAssign(quizId: string) {
    setAssigning(quizId)
    setActionError(null)
    const { error: e } = await assignQuiz(profileId, quizId)
    setAssigning(null)
    if (e) { setActionError(e); return }
    setPickerOpen(false)
    await load()
  }

  // ── Unassign ──────────────────────────────────────────────────────────────

  async function handleUnassign(assignmentId: string) {
    setRemovingId(assignmentId)
    setActionError(null)
    const { error: e } = await unassignQuiz(assignmentId)
    setRemovingId(null)
    if (e) { setActionError(e); return }
    await load()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Scoring view — shown when supervisor clicks a submitted assignment row.
  if (scoring) {
    return (
      <ScoringPanel
        assignmentId={scoring.assignmentId}
        quizName={scoring.quizName}
        onBack={() => { setScoring(null); load() }}
      />
    )
  }

  if (loading) {
    return <p style={{ padding: '20px 0', fontSize: 13, color: 'var(--color-ink-muted)' }}>Loading quizzes…</p>
  }

  if (error) {
    return <p style={{ padding: '20px 0', fontSize: 13, color: 'var(--color-incorrect)' }}>{error}</p>
  }

  // Quiz IDs already assigned — filter them out of the picker
  const assignedQuizIds = new Set(assignments.map(a => a.quiz.id))
  const available = library.filter(q => !assignedQuizIds.has(q.id))

  return (
    <div>
      {/* Assignment list */}
      {assignments.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginBottom: 20 }}>
          No quizzes assigned yet.
        </p>
      ) : (
        <div className="card" style={{ overflow: 'hidden', padding: 0, marginBottom: 16 }}>
          {assignments.map((a, idx) => (
            <div
              key={a.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)',
                opacity: removingId === a.id ? 0.5 : 1,
                transition: 'opacity 150ms',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink)' }}>
                  {a.quiz.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-ink-muted)', marginTop: 2 }}>
                  Assigned {new Date(a.assigned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {a.completed_at && (
                    <> &middot; Submitted {new Date(a.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                  )}
                </div>
              </div>

              <StatusBadge status={a.status} />

              {/* Submitted: Score button. Others: Remove button. */}
              {a.status === 'submitted' ? (
                <button
                  type="button"
                  onClick={() => setScoring({ assignmentId: a.id, quizName: a.quiz.name })}
                  title="Score open answers"
                  style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 5, padding: '4px 10px', borderRadius: 6,
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer', background: 'var(--color-surface)',
                    color: 'var(--color-ink-muted)', fontSize: 11, fontWeight: 500,
                    fontFamily: 'var(--font-sans)',
                    transition: 'background 120ms, color 120ms, border-color 120ms',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = 'var(--color-accent-soft)'
                    el.style.color = 'var(--color-accent)'
                    el.style.borderColor = 'var(--color-accent)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = 'var(--color-surface)'
                    el.style.color = 'var(--color-ink-muted)'
                    el.style.borderColor = 'var(--color-border)'
                  }}
                >
                  <ClipboardCheck size={12} /> Score
                </button>
              ) : (
                <button
                  type="button"
                  disabled={removingId === a.id}
                  onClick={() => handleUnassign(a.id)}
                  title="Remove assignment"
                  style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: 6, border: 'none',
                    cursor: 'pointer', background: 'transparent', color: 'var(--color-ink-muted)',
                    transition: 'background 120ms, color 120ms',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = 'var(--color-incorrect-soft)'
                    el.style.color = 'var(--color-incorrect)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = 'transparent'
                    el.style.color = 'var(--color-ink-muted)'
                  }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <p style={{ fontSize: 12, color: 'var(--color-incorrect)', marginBottom: 12 }}>
          {actionError}
        </p>
      )}

      {/* Picker — shown inline below the list */}
      {pickerOpen ? (
        <div className="card" style={{ padding: 16 }}>
          {available.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-muted)' }}>
              All quizzes in the library are already assigned.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--color-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Choose a quiz
              </p>
              {available.map(q => (
                <button
                  key={q.id}
                  type="button"
                  disabled={assigning === q.id}
                  onClick={() => handleAssign(q.id)}
                  style={{
                    textAlign: 'left', padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--color-border)', cursor: 'pointer',
                    background: 'var(--color-surface)', fontSize: 13,
                    color: 'var(--color-ink)', fontFamily: 'var(--font-sans)',
                    opacity: assigning === q.id ? 0.6 : 1,
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={e => {
                    if (assigning !== q.id)
                      (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-sunk)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)'
                  }}
                >
                  {assigning === q.id ? 'Assigning…' : q.name}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => { setPickerOpen(false); setActionError(null) }}
            style={{
              marginTop: 12, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--color-ink-muted)', fontFamily: 'var(--font-sans)',
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        library.length > 0 && (
          <button
            type="button"
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            onClick={() => { setPickerOpen(true); setActionError(null) }}
          >
            <Plus size={14} /> Assign quiz
          </button>
        )
      )}

      {/* Empty library hint */}
      {library.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--color-ink-muted)' }}>
          No quizzes in the library yet. Create one from the Quizzes tab first.
        </p>
      )}
    </div>
  )
}
