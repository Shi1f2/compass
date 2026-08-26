/**
 * components/console/AssignmentPanel.tsx
 * Knowledge tab body for a single starter.
 *
 * Layout
 * ──────
 * Section header with a segmented control: Unfinished | Finished
 *   Unfinished: assignments whose status is not 'submitted'
 *     Row: quiz name, question count, assigned date
 *     Empty: "No unfinished assignments."
 *   Finished: submitted assignments
 *     Row: quiz name, score summary, Score button
 *     Empty: "Nothing has been submitted yet."
 *   Below both lists: a "+" button that opens a small menu:
 *     • Assign an existing quiz   — picker of org quizzes not already assigned
 *     • Create a new quiz         — inline QuizEditor (creates + assigns in one action)
 *   If org has no quizzes at all, the picker says so and shows "Create instead".
 *
 * Scoring view: clicking a finished row replaces the panel with ScoringPanel.
 */
'use client'

import { useCallback, useEffect, useReducer, useState } from 'react'
import { ClipboardCheck, Plus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { assignQuiz, createQuiz, unassignQuiz } from '@/lib/quiz-actions'
import { QuizEditor } from './QuizLibrary'
import ScoringPanel from './ScoringPanel'
import type { Quiz } from '@/lib/database.types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssignmentRow {
  id:               string
  status:           string
  assigned_at:      string
  completed_at:     string | null
  overall_feedback: string | null
  quiz: {
    id:             string
    name:           string
    question_count: number
  }
}

interface QuizOption {
  id:             string
  name:           string
  question_count: number
}

type Segment = 'unfinished' | 'finished'

// Menu state: closed | pick (assign-existing picker) | create (new-quiz form)
type MenuState = 'closed' | 'pick' | 'create'

// ─── Small helpers ────────────────────────────────────────────────────────────

function segBtn(
  label: string,
  active: boolean,
  onClick: () => void,
): React.ReactNode {
  return (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 14px', borderRadius: 9999, border: 'none',
        cursor: 'pointer', fontSize: 12, fontWeight: 500,
        background: active ? 'var(--color-accent)'      : 'transparent',
        color:      active ? '#fff'                     : 'var(--color-ink-muted)',
        transition: 'background 150ms, color 150ms',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {label}
    </button>
  )
}

// ─── New-quiz creation form (name + description) ──────────────────────────────

interface NewQuizFormState {
  name:    string
  desc:    string
  saving:  boolean
  error:   string | null
}

const EMPTY_NQ: NewQuizFormState = { name: '', desc: '', saving: false, error: null }

function newQuizReducer(
  s: NewQuizFormState,
  p: Partial<NewQuizFormState>,
): NewQuizFormState {
  return { ...s, ...p }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AssignmentPanelProps {
  /** The intern whose assignments are shown. */
  profileId: string
  /** org UUID — required to scope createQuiz. */
  orgId:     string
}

export default function AssignmentPanel({ profileId, orgId }: AssignmentPanelProps) {
  const supabase = createClient()

  const [segment,      setSegment]      = useState<Segment>('unfinished')
  const [assignments,  setAssignments]  = useState<AssignmentRow[]>([])
  const [library,      setLibrary]      = useState<QuizOption[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  const [menu,         setMenu]         = useState<MenuState>('closed')
  const [assigning,    setAssigning]    = useState<string | null>(null)
  const [removingId,   setRemovingId]   = useState<string | null>(null)
  const [actionError,  setActionError]  = useState<string | null>(null)

  // New-quiz form state
  const [nqForm, nqDispatch] = useReducer(newQuizReducer, EMPTY_NQ)
  // Once a new quiz is created, hold its Quiz object here to open QuizEditor
  const [createdQuiz, setCreatedQuiz] = useState<Quiz | null>(null)

  // Scoring state — non-null when supervisor is reviewing a submitted/published assignment
  const [scoring, setScoring] = useState<{
    assignmentId:    string
    quizName:        string
    status:          string
    overallFeedback: string | null
  } | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [aRes, qRes] = await Promise.all([
      // Assignments for this intern — join quiz name + question count
      supabase
        .from('quiz_assignments')
        .select(`
          id, status, assigned_at, completed_at, overall_feedback,
          quiz:quizzes(
            id, name,
            question_count:quiz_questions(count)
          )
        `)
        .eq('profile_id', profileId)
        .order('assigned_at', { ascending: true }),
      // Full org quiz library
      supabase
        .from('quizzes')
        .select('id, name, question_count:quiz_questions(count)')
        .eq('org_id', orgId)
        .order('name', { ascending: true }),
    ])

    if (aRes.error) { setError(aRes.error.message); setLoading(false); return }
    if (qRes.error) { setError(qRes.error.message); setLoading(false); return }

    // Supabase returns aggregates as { count: number }[] — flatten to number.
    const normaliseCount = (raw: unknown): number => {
      if (typeof raw === 'number') return raw
      if (Array.isArray(raw) && raw.length > 0) {
        const first = raw[0]
        if (first && typeof first === 'object' && 'count' in first) {
          return Number((first as { count: unknown }).count)
        }
      }
      return 0
    }

    const assignments: AssignmentRow[] = (aRes.data ?? []).map(a => {
      // quiz may be an array (1:1 embed as array) or a single object
      const quizRaw = Array.isArray(a.quiz) ? a.quiz[0] : a.quiz
      return {
        id:               a.id,
        status:           a.status,
        assigned_at:      a.assigned_at,
        completed_at:     a.completed_at,
        overall_feedback: (a as unknown as { overall_feedback: string | null }).overall_feedback ?? null,
        quiz: {
          id:             quizRaw?.id ?? '',
          name:           quizRaw?.name ?? '',
          question_count: normaliseCount(quizRaw?.question_count),
        },
      }
    })

    const libraryOpts: QuizOption[] = (qRes.data ?? []).map(q => ({
      id:             q.id,
      name:           q.name,
      question_count: normaliseCount(q.question_count),
    }))

    setAssignments(assignments)
    setLibrary(libraryOpts)
    setLoading(false)
  }, [profileId, orgId, supabase])

  useEffect(() => { load() }, [load])

  // ── Assign existing quiz ──────────────────────────────────────────────────

  async function handleAssign(quizId: string) {
    setAssigning(quizId)
    setActionError(null)
    const { error: e } = await assignQuiz(profileId, quizId)
    setAssigning(null)
    if (e) { setActionError(e); return }
    setMenu('closed')
    await load()
  }

  // ── Create new quiz then assign ───────────────────────────────────────────

  async function handleCreateAndAssign() {
    const name = nqForm.name.trim()
    if (!name) return
    nqDispatch({ saving: true, error: null })

    const { id: quizId, error: createErr } = await createQuiz(name, nqForm.desc)
    if (createErr || !quizId) {
      nqDispatch({ saving: false, error: createErr ?? 'Failed to create quiz.' })
      return
    }

    // Assign to this person
    const { error: assignErr } = await assignQuiz(profileId, quizId)
    if (assignErr) {
      nqDispatch({ saving: false, error: assignErr })
      return
    }

    // Open the QuizEditor for the newly-created quiz
    const newQuiz: Quiz = {
      id:          quizId,
      org_id:      orgId,
      name,
      description: nqForm.desc.trim(),
      created_by:  '',
      created_at:  new Date().toISOString(),
    }
    nqDispatch(EMPTY_NQ)
    setCreatedQuiz(newQuiz)
    setMenu('closed')
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

  // ── Scoring view ──────────────────────────────────────────────────────────

  if (scoring) {
    return (
      <ScoringPanel
        assignmentId={scoring.assignmentId}
        quizName={scoring.quizName}
        initialStatus={scoring.status}
        initialFeedback={scoring.overallFeedback}
        onBack={() => { setScoring(null); load() }}
      />
    )
  }

  // ── QuizEditor view (after "Create new quiz") ─────────────────────────────

  if (createdQuiz) {
    return (
      <QuizEditor
        quiz={createdQuiz}
        orgId={orgId}
        onBack={() => { setCreatedQuiz(null); load() }}
        onSaved={updated => setCreatedQuiz(updated)}
        onDeleted={() => { setCreatedQuiz(null); load() }}
      />
    )
  }

  // ── Derived lists ──────────────────────────────────────────────────────────

  const unfinished = assignments.filter(a => a.status !== 'submitted' && a.status !== 'published')
  const finished   = assignments.filter(a => a.status === 'submitted' || a.status === 'published')
  const assignedQuizIds = new Set(assignments.map(a => a.quiz.id))
  const available = library.filter(q => !assignedQuizIds.has(q.id))
  const noOrgQuizzes = library.length === 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 760 }}>

      {/* Section header: title + segmented control */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>
          Quizzes
        </span>
        <div style={{
          display: 'flex', gap: 2, padding: '3px',
          background: 'var(--color-sunk)', borderRadius: 9999,
        }}>
          {segBtn('Unfinished', segment === 'unfinished', () => setSegment('unfinished'))}
          {segBtn('Finished',   segment === 'finished',   () => setSegment('finished'))}
        </div>
      </div>

      {/* Loading / error */}
      {loading && (
        <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', margin: '0 0 16px' }}>
          Loading quizzes…
        </p>
      )}
      {error && (
        <p style={{ fontSize: 13, color: 'var(--color-incorrect)', margin: '0 0 16px' }}>{error}</p>
      )}

      {/* Assignment list */}
      {!loading && !error && (
        <div className="card" style={{ overflow: 'hidden', padding: 0, marginBottom: 16 }}>
          {segment === 'unfinished' && (
            unfinished.length === 0 ? (
              <p style={{ margin: 0, padding: '16px', fontSize: 13, color: 'var(--color-ink-muted)' }}>
                No unfinished assignments.
              </p>
            ) : (
              unfinished.map((a, idx) => (
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
                      {a.quiz.question_count === 1 ? '1 question' : `${a.quiz.question_count} questions`}
                      {' · '}
                      Assigned {new Date(a.assigned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>

                  {/* Status badge */}
                  <StatusBadge status={a.status} />

                  {/* Remove (unassign) button */}
                  <button
                    type="button"
                    disabled={removingId === a.id}
                    onClick={() => handleUnassign(a.id)}
                    title="Remove assignment"
                    style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, borderRadius: 6, border: 'none',
                      cursor: removingId === a.id ? 'not-allowed' : 'pointer',
                      background: 'transparent', color: 'var(--color-ink-muted)',
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
                </div>
              ))
            )
          )}

          {segment === 'finished' && (
            finished.length === 0 ? (
              <p style={{ margin: 0, padding: '16px', fontSize: 13, color: 'var(--color-ink-muted)' }}>
                Nothing has been submitted yet.
              </p>
            ) : (
              finished.map((a, idx) => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink)' }}>
                      {a.quiz.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-ink-muted)', marginTop: 2 }}>
                      Submitted {a.completed_at
                        ? new Date(a.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </div>
                  </div>

                  {/* Score / Review button */}
                  <button
                    type="button"
                    onClick={() => setScoring({
                      assignmentId:    a.id,
                      quizName:        a.quiz.name,
                      status:          a.status,
                      overallFeedback: a.overall_feedback,
                    })}
                    title={a.status === 'published' ? 'View published review' : 'Open scoring view'}
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
                    <ClipboardCheck size={12} /> {a.status === 'published' ? 'Review' : 'Score'}
                  </button>
                </div>
              ))
            )
          )}
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <p style={{ fontSize: 12, color: 'var(--color-incorrect)', marginBottom: 12 }}>
          {actionError}
        </p>
      )}

      {/* "+" button + inline menu */}
      {!loading && !error && (
        menu === 'closed' ? (
          <button
            type="button"
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            onClick={() => { setActionError(null); setMenu(noOrgQuizzes ? 'create' : 'pick') }}
          >
            <Plus size={14} /> Add quiz
          </button>
        ) : menu === 'pick' ? (
          <div className="card" style={{ padding: 16 }}>
            {/* Header row with close button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Add quiz
              </p>
              <button
                type="button"
                onClick={() => { setMenu('closed'); setActionError(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-muted)', padding: 2, display: 'flex' }}
              >
                <X size={14} />
              </button>
            </div>

            {available.length === 0 ? (
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-ink-muted)' }}>
                All quizzes in the library are already assigned to this person.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {available.map(q => (
                  <button
                    key={q.id}
                    type="button"
                    disabled={assigning === q.id}
                    onClick={() => handleAssign(q.id)}
                    style={{
                      textAlign: 'left', padding: '8px 12px', borderRadius: 8,
                      border: '1px solid var(--color-border)', cursor: assigning === q.id ? 'not-allowed' : 'pointer',
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
                    <span style={{ fontWeight: 500 }}>{q.name}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-ink-muted)' }}>
                      {q.question_count === 1 ? '1 question' : `${q.question_count} questions`}
                    </span>
                    {assigning === q.id && <span style={{ marginLeft: 8, fontSize: 11 }}>Assigning…</span>}
                  </button>
                ))}
              </div>
            )}

            {/* "Create a new quiz instead" link */}
            <button
              type="button"
              onClick={() => { setMenu('create'); nqDispatch(EMPTY_NQ) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'var(--color-accent)', fontFamily: 'var(--font-sans)',
                padding: 0, textDecoration: 'underline',
              }}
            >
              Create a new quiz instead
            </button>
          </div>
        ) : /* menu === 'create' */ (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Create &amp; assign new quiz
              </p>
              <button
                type="button"
                onClick={() => { setMenu('closed'); nqDispatch(EMPTY_NQ); setActionError(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-muted)', padding: 2, display: 'flex' }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
                Quiz name
              </label>
              <input
                className="field"
                style={{ width: '100%' }}
                value={nqForm.name}
                onChange={e => nqDispatch({ name: e.target.value })}
                placeholder="e.g. System access quiz"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleCreateAndAssign() }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
                Description (optional)
              </label>
              <input
                className="field"
                style={{ width: '100%' }}
                value={nqForm.desc}
                onChange={e => nqDispatch({ desc: e.target.value })}
                placeholder="What this quiz covers"
              />
            </div>

            {nqForm.error && (
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--color-incorrect)' }}>{nqForm.error}</p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={handleCreateAndAssign}
                disabled={nqForm.saving || !nqForm.name.trim()}
              >
                {nqForm.saving ? 'Creating…' : 'Create quiz'}
              </button>
              {library.length > 0 && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setMenu('pick'); nqDispatch(EMPTY_NQ) }}
                >
                  Assign existing instead
                </button>
              )}
            </div>
          </div>
        )
      )}
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  assigned:    { label: 'Not started', bg: 'var(--color-sunk)',         color: 'var(--color-ink-muted)' },
  in_progress: { label: 'In progress', bg: 'var(--color-yellow-soft)',  color: 'var(--color-waiting)'   },
  submitted:   { label: 'Submitted',   bg: 'var(--color-yellow-soft)',  color: 'var(--color-waiting)'   },
  published:   { label: 'Published',   bg: 'var(--color-correct-soft)', color: 'var(--color-correct)'   },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status]
  if (!s) return null
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 500,
      background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  )
}
