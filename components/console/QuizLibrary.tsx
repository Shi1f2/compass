/**
 * components/console/QuizLibrary.tsx
 * Supervisor quiz library — list, create, edit.
 *
 * Views (rendered in-place, no navigation):
 *   'list'   — all quizzes for the org, question + assignment counts, + button
 *   'editor' — selected quiz name/description + question list
 *
 * Data flow:
 *   - Reads via browser client (respects RLS; supervisor sees own org's quizzes)
 *   - All writes go through server actions in lib/quiz-actions.ts
 */
'use client'

import {
  useCallback, useEffect, useReducer, useRef, useState,
} from 'react'
import {
  ArrowLeft, Check, ChevronDown, ChevronUp,
  Plus, Trash2, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Quiz, QuizQuestion } from '@/lib/database.types'
import {
  createQuiz,
  updateQuiz,
  deleteQuiz,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  countQuizAssignments,
} from '@/lib/quiz-actions'

// ─── Local types ──────────────────────────────────────────────────────────────

interface QuizRow extends Quiz {
  question_count:   number
  assignment_count: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
      {children}
    </label>
  )
}

function IconBtn({
  onClick, title, disabled = false, danger = false, children,
}: {
  onClick: () => void
  title: string
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, borderRadius: 6, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: 'transparent',
        color: danger ? 'var(--color-incorrect)' : 'var(--color-ink-muted)',
        opacity: disabled ? 0.35 : 1,
        transition: 'background 120ms, color 120ms',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-sunk)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}

// ─── Question editor row ──────────────────────────────────────────────────────

interface QuestionRowProps {
  question:   QuizQuestion
  index:      number
  total:      number
  onUpdate:   (patch: Partial<QuizQuestion>) => void
  onDelete:   () => void
  onMoveUp:   () => void
  onMoveDown: () => void
  saving:     boolean
}

function QuestionRow({
  question, index, total, onUpdate, onDelete, onMoveUp, onMoveDown, saving,
}: QuestionRowProps) {
  const [expanded, setExpanded] = useState(index === 0)
  const isFirst = index === 0
  const isLast  = index === total - 1
  const isMC    = question.kind === 'multiple_choice'

  // Local option list — kept in sync with server state via onUpdate
  const options: string[] = Array.isArray(question.options) ? question.options : []

  function setOption(i: number, val: string) {
    const next = [...options]
    next[i] = val
    onUpdate({ options: next })
  }

  function addOption() {
    onUpdate({ options: [...options, ''] })
  }

  function removeOption(i: number) {
    const next = options.filter((_, idx) => idx !== i)
    // If correct_option was pointing at removed index, reset to 0
    const correct = question.correct_option ?? 0
    onUpdate({
      options:        next,
      correct_option: correct >= next.length ? 0 : correct,
    })
  }

  return (
    <div
      className="card"
      style={{
        padding: 0, overflow: 'hidden',
        opacity: saving ? 0.6 : 1, transition: 'opacity 150ms',
      }}
    >
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '12px 16px',
          background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', fontFamily: 'var(--font-sans)',
        }}
      >
        <span style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
          background: 'var(--color-sunk)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'var(--color-ink-muted)',
        }}>
          {index + 1}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {question.prompt}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-ink-muted)', flexShrink: 0, marginRight: 4 }}>
          {isMC ? 'Multiple choice' : 'Open'}
        </span>
        {expanded ? <ChevronUp size={14} color="var(--color-ink-muted)" /> : <ChevronDown size={14} color="var(--color-ink-muted)" />}
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--color-border)' }}>
          {/* Kind toggle */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, marginBottom: 14 }}>
            {(['multiple_choice', 'open'] as const).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  if (k === question.kind) return
                  // Switch kind — reset fields to valid defaults
                  if (k === 'multiple_choice') {
                    onUpdate({ kind: k, options: ['Option A', 'Option B'], correct_option: 0, model_answer: null })
                  } else {
                    onUpdate({ kind: k, options: null, correct_option: null, model_answer: '' })
                  }
                }}
                style={{
                  padding: '5px 14px', borderRadius: 9999, border: 'none',
                  cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  background: question.kind === k ? 'var(--color-accent-soft)' : 'var(--color-sunk)',
                  color:      question.kind === k ? 'var(--color-accent)'      : 'var(--color-ink-muted)',
                  transition: 'background 120ms, color 120ms',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {k === 'multiple_choice' ? 'Multiple choice' : 'Open answer'}
              </button>
            ))}
          </div>

          {/* Prompt */}
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Question</FieldLabel>
            <textarea
              className="field"
              rows={2}
              value={question.prompt}
              onChange={e => onUpdate({ prompt: e.target.value })}
              style={{ resize: 'vertical', width: '100%' }}
            />
          </div>

          {/* Multiple-choice options */}
          {isMC && (
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Options — click the circle to mark correct</FieldLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Correct-answer radio */}
                    <button
                      type="button"
                      aria-label={`Mark option ${i + 1} as correct`}
                      onClick={() => onUpdate({ correct_option: i })}
                      style={{
                        flexShrink: 0,
                        width: 20, height: 20, borderRadius: '50%', border: 'none',
                        cursor: 'pointer',
                        background: question.correct_option === i ? 'var(--color-accent)' : 'transparent',
                        outline: question.correct_option === i ? 'none' : '1.5px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 120ms',
                      }}
                    >
                      {question.correct_option === i && <Check size={10} strokeWidth={3} color="#fff" />}
                    </button>
                    <input
                      className="field"
                      value={opt}
                      onChange={e => setOption(i, e.target.value)}
                      style={{ flex: 1 }}
                      placeholder={`Option ${i + 1}`}
                    />
                    <IconBtn onClick={() => removeOption(i)} title="Remove option" disabled={options.length <= 2}>
                      <X size={13} />
                    </IconBtn>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addOption}
                  style={{
                    marginTop: 2, padding: '5px 12px',
                    borderRadius: 6, border: '1px dashed var(--color-border)',
                    background: 'none', cursor: 'pointer', fontSize: 12,
                    color: 'var(--color-ink-muted)', fontFamily: 'var(--font-sans)',
                    display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                  }}
                >
                  <Plus size={12} /> Add option
                </button>
              </div>
            </div>
          )}

          {/* Open model answer */}
          {!isMC && (
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Model answer (shown to supervisor during review)</FieldLabel>
              <textarea
                className="field"
                rows={3}
                value={question.model_answer ?? ''}
                onChange={e => onUpdate({ model_answer: e.target.value })}
                style={{ resize: 'vertical', width: '100%' }}
              />
            </div>
          )}

          {/* Row controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <IconBtn onClick={onMoveUp}   title="Move up"   disabled={isFirst}><ChevronUp   size={14} /></IconBtn>
              <IconBtn onClick={onMoveDown} title="Move down" disabled={isLast}> <ChevronDown size={14} /></IconBtn>
            </div>
            <IconBtn onClick={onDelete} title="Delete question" danger>
              <Trash2 size={14} />
            </IconBtn>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Quiz editor ──────────────────────────────────────────────────────────────

export interface QuizEditorProps {
  quiz:      Quiz
  orgId:     string
  onBack:    () => void
  onSaved:   (quiz: Quiz) => void
  onDeleted: () => void
}

export function QuizEditor({ quiz, onBack, onSaved, onDeleted }: QuizEditorProps) {
  const supabase = createClient()

  const [name,        setName]        = useState(quiz.name)
  const [description, setDescription] = useState(quiz.description)
  const [questions,   setQuestions]   = useState<QuizQuestion[]>([])
  const [loadingQs,   setLoadingQs]   = useState(true)
  const [savingMeta,  setSavingMeta]  = useState(false)
  const [savingQIds,  setSavingQIds]  = useState<Set<string>>(new Set())
  const [deletingQId, setDeletingQId] = useState<string | null>(null)
  const [metaError,   setMetaError]   = useState<string | null>(null)

  // Delete-quiz confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteCount,   setDeleteCount]   = useState<number | null>(null)
  const [deleting,      setDeleting]      = useState(false)
  const [deleteError,   setDeleteError]   = useState<string | null>(null)

  // Debounce refs for question field saves
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // ── Load questions ─────────────────────────────────────────────────────────

  useEffect(() => {
    let active = true
    supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('order_index', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (!error && data) setQuestions(data)
        setLoadingQs(false)
      })
    return () => { active = false }
  }, [quiz.id, supabase])

  // ── Save quiz meta (name / description) ────────────────────────────────────

  async function saveMeta() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSavingMeta(true)
    setMetaError(null)
    const { error } = await updateQuiz(quiz.id, { name: trimmed, description })
    setSavingMeta(false)
    if (error) { setMetaError(error); return }
    onSaved({ ...quiz, name: trimmed, description })
  }

  // ── Save a question field (debounced 600 ms) ───────────────────────────────

  function scheduleQuestionSave(qId: string, patch: Partial<QuizQuestion>) {
    // Optimistic local update
    setQuestions(qs => qs.map(q => q.id === qId ? { ...q, ...patch } : q))

    clearTimeout(debounceRefs.current[qId])
    debounceRefs.current[qId] = setTimeout(async () => {
      setSavingQIds(s => new Set(s).add(qId))
      await updateQuestion(qId, patch)
      setSavingQIds(s => { const n = new Set(s); n.delete(qId); return n })
    }, 600)
  }

  // ── Add question ───────────────────────────────────────────────────────────

  async function handleAddQuestion(kind: 'multiple_choice' | 'open') {
    const orderIndex = questions.length
    const { id, error } = await createQuestion(quiz.id, kind, orderIndex)
    if (error || !id) return
    // Fetch the inserted row so we have all defaults
    const { data } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('id', id)
      .single()
    if (data) setQuestions(qs => [...qs, data])
  }

  // ── Delete question ────────────────────────────────────────────────────────

  async function handleDeleteQuestion(qId: string) {
    setDeletingQId(qId)
    await deleteQuestion(qId)
    setQuestions(qs => qs.filter(q => q.id !== qId))
    setDeletingQId(null)
    // Re-index remaining
    const remaining = questions.filter(q => q.id !== qId).map(q => q.id)
    if (remaining.length > 0) await reorderQuestions(remaining)
  }

  // ── Move question ──────────────────────────────────────────────────────────

  async function handleMove(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= questions.length) return
    const next = [...questions]
    const tmp = next[idx]!
    next[idx]   = next[target]!
    next[target] = tmp
    setQuestions(next)
    await reorderQuestions(next.map(q => q.id))
  }

  // ── Delete quiz ────────────────────────────────────────────────────────────

  async function handleDeleteQuiz() {
    if (!deleteConfirm) {
      const { count } = await countQuizAssignments(quiz.id)
      setDeleteCount(count)
      setDeleteConfirm(true)
      return
    }
    setDeleting(true)
    const { error } = await deleteQuiz(quiz.id)
    setDeleting(false)
    if (error) { setDeleteError(error); return }
    onDeleted()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--color-page)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '36px 24px' }}>

        {/* Back */}
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 9999, border: 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: 'transparent', color: 'var(--color-ink-muted)',
            fontFamily: 'var(--font-sans)', marginBottom: 24,
            transition: 'background 150ms, color 150ms',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-sunk)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-ink)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-ink-muted)' }}
        >
          <ArrowLeft size={16} /> Quiz library
        </button>

        {/* Meta card */}
        <div className="card" style={{ padding: 24, marginBottom: 28 }}>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Quiz name</FieldLabel>
            <input
              className="field"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Description (optional)</FieldLabel>
            <textarea
              className="field"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ resize: 'vertical', width: '100%' }}
            />
          </div>

          {metaError && (
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-incorrect)' }}>{metaError}</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="btn"
              onClick={saveMeta}
              disabled={savingMeta || !name.trim()}
            >
              {savingMeta ? 'Saving…' : 'Save'}
            </button>

            {/* Delete quiz */}
            {!deleteConfirm ? (
              <button
                type="button"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: 'var(--color-ink-muted)',
                  fontFamily: 'var(--font-sans)', padding: '4px 8px', borderRadius: 6,
                  transition: 'color 120ms',
                }}
                onClick={handleDeleteQuiz}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-incorrect)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-ink-muted)' }}
              >
                Delete quiz
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                {deleteCount !== null && deleteCount > 0 && (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-incorrect)' }}>
                    This quiz has {plural(deleteCount, 'active assignment')}. Deleting it will fail.
                  </p>
                )}
                {deleteError && (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-incorrect)' }}>{deleteError}</p>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={() => { setDeleteConfirm(false); setDeleteError(null) }}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: 'none',
                      cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: 'var(--color-incorrect)', color: '#fff',
                      fontFamily: 'var(--font-sans)',
                      opacity: deleting ? 0.6 : 1,
                    }}
                    onClick={handleDeleteQuiz}
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Questions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            Questions
            {questions.length > 0 && (
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-ink-muted)', marginLeft: 8 }}>
                {plural(questions.length, 'question')}
              </span>
            )}
          </h2>
        </div>

        {loadingQs ? (
          <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>Loading questions…</p>
        ) : (
          <>
            {questions.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginBottom: 20 }}>
                No questions yet. Add one below.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {questions.map((q, idx) => (
                <QuestionRow
                  key={q.id}
                  question={q}
                  index={idx}
                  total={questions.length}
                  onUpdate={patch => scheduleQuestionSave(q.id, patch)}
                  onDelete={() => handleDeleteQuestion(q.id)}
                  onMoveUp={() => handleMove(idx, -1)}
                  onMoveDown={() => handleMove(idx, 1)}
                  saving={savingQIds.has(q.id) || deletingQId === q.id}
                />
              ))}
            </div>

            {/* Add-question buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                onClick={() => handleAddQuestion('multiple_choice')}
              >
                <Plus size={14} /> Multiple choice
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                onClick={() => handleAddQuestion('open')}
              >
                <Plus size={14} /> Open answer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Quiz library list ────────────────────────────────────────────────────────

interface NewQuizFormState {
  open:  boolean
  name:  string
  desc:  string
  error: string | null
  saving: boolean
}

const EMPTY_FORM: NewQuizFormState = { open: false, name: '', desc: '', error: null, saving: false }

interface QuizLibraryProps {
  orgId: string
}

export default function QuizLibrary({ orgId }: QuizLibraryProps) {
  const supabase = createClient()

  const [quizzes,  setQuizzes]  = useState<QuizRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [editing,  setEditing]  = useState<Quiz | null>(null)
  const [form,     setForm]     = useReducer(
    (s: NewQuizFormState, p: Partial<NewQuizFormState>) => ({ ...s, ...p }),
    EMPTY_FORM,
  )

  // ── Load library ────────────────────────────────────────────────────────────

  const loadQuizzes = useCallback(async () => {
    setLoading(true)
    // Load quizzes; then aggregate counts in parallel.
    const { data: rows } = await (supabase
      .from('quizzes')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true }) as unknown as
      Promise<{ data: Quiz[] | null; error: unknown }>)

    if (!rows) { setLoading(false); return }

    // question counts + assignment counts in parallel
    const [qcounts, acounts] = await Promise.all([
      supabase
        .from('quiz_questions')
        .select('quiz_id')
        .in('quiz_id', rows.map(r => r.id)) as unknown as
        Promise<{ data: { quiz_id: string }[] | null }>,
      supabase
        .from('quiz_assignments')
        .select('quiz_id')
        .in('quiz_id', rows.map(r => r.id)) as unknown as
        Promise<{ data: { quiz_id: string }[] | null }>,
    ])

    const qMap: Record<string, number> = {}
    const aMap: Record<string, number> = {}
    for (const r of qcounts.data ?? []) qMap[r.quiz_id] = (qMap[r.quiz_id] ?? 0) + 1
    for (const r of acounts.data ?? []) aMap[r.quiz_id] = (aMap[r.quiz_id] ?? 0) + 1

    setQuizzes(rows.map(r => ({
      ...r,
      question_count:   qMap[r.id] ?? 0,
      assignment_count: aMap[r.id] ?? 0,
    })))
    setLoading(false)
  }, [orgId, supabase])

  useEffect(() => { loadQuizzes() }, [loadQuizzes])

  // ── Create quiz ─────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!form.name.trim()) return
    setForm({ saving: true, error: null })
    const { id, error } = await createQuiz(form.name, form.desc)
    if (error) { setForm({ saving: false, error }); return }
    setForm(EMPTY_FORM)
    // Refresh list then open the editor immediately
    await loadQuizzes()
    if (id) {
      const fresh = { id, org_id: orgId, name: form.name.trim(), description: form.desc.trim(), created_by: '', created_at: '' }
      setEditing(fresh)
    }
  }

  // ── Editor callbacks ────────────────────────────────────────────────────────

  function handleSaved(updated: Quiz) {
    setQuizzes(qs => qs.map(q => q.id === updated.id ? { ...q, ...updated } : q))
  }

  function handleDeleted() {
    setEditing(null)
    loadQuizzes()
  }

  // ── Editor view ─────────────────────────────────────────────────────────────

  if (editing) {
    return (
      <QuizEditor
        quiz={editing}
        orgId={orgId}
        onBack={() => setEditing(null)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    )
  }

  // ── List view ───────────────────────────────────────────────────────────────

  return (
    <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--color-page)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '36px 24px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Quiz library
          </h1>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>Loading quizzes…</p>
        ) : quizzes.length === 0 && !form.open ? (
          <div style={{ textAlign: 'center', padding: '48px 32px' }}>
            <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>
              No quizzes yet
            </p>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--color-ink-muted)' }}>
              Create a quiz once and assign it to any new starter.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {quizzes.map(q => (
              <button
                key={q.id}
                type="button"
                className="card-btn"
                onClick={() => setEditing(q)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', width: '100%', textAlign: 'left', gap: 16,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 2 }}>
                    {q.name}
                  </div>
                  {q.description && (
                    <div style={{ fontSize: 12, color: 'var(--color-ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {q.description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                  <Chip label={plural(q.question_count, 'question')} />
                  <Chip label={plural(q.assignment_count, 'assigned')} muted={q.assignment_count === 0} />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* New quiz form */}
        {form.open ? (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ marginBottom: 12 }}>
              <FieldLabel>Quiz name</FieldLabel>
              <input
                className="field"
                style={{ width: '100%' }}
                value={form.name}
                onChange={e => setForm({ name: e.target.value })}
                placeholder="e.g. System access quiz"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <FieldLabel>Description (optional)</FieldLabel>
              <input
                className="field"
                style={{ width: '100%' }}
                value={form.desc}
                onChange={e => setForm({ desc: e.target.value })}
                placeholder="What this quiz covers"
              />
            </div>
            {form.error && (
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--color-incorrect)' }}>{form.error}</p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={handleCreate}
                disabled={form.saving || !form.name.trim()}
              >
                {form.saving ? 'Creating…' : 'Create quiz'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setForm(EMPTY_FORM)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={() => setForm({ open: true })}
          >
            <Plus size={15} /> New quiz
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Small stat chip ──────────────────────────────────────────────────────────

function Chip({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 500,
      background: muted ? 'var(--color-sunk)' : 'var(--color-violet-soft)',
      color:      muted ? 'var(--color-ink-muted)' : 'var(--color-violet)',
    }}>
      {label}
    </span>
  )
}
