/**
 * components/console/InternTasks.tsx
 * Intern's own task list with checkboxes.
 * Reads tasks via the browser client; toggle calls a server action.
 * The DB trigger sets completed_at — the client only sends status.
 *
 * view='checklist' (default) — Tasks tab: heading + tickable rows; no bar.
 * view='bar'                 — Profile page: segmented bar card only; no rows.
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Task } from '@/lib/database.types'
import { toggleTaskStatus } from '@/lib/task-actions'
import TaskBar from './TaskBar'

// ─── Props ────────────────────────────────────────────────────────────────────

interface InternTasksProps {
  /** Which portion to render. Defaults to 'checklist'. */
  view?: 'checklist' | 'bar'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InternTasks({ view = 'checklist' }: InternTasksProps) {
  const supabase = createClient()

  const [tasks,       setTasks]       = useState<Task[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [toggling,    setToggling]    = useState<Set<string>>(new Set())
  const [jobRoleName, setJobRoleName] = useState<string | undefined>(undefined)
  // Refs to each task row — used by the bar's segment click to scroll.
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user || !active) return
      const userId = data.user.id

      // Fetch tasks and job role name in parallel
      const [tasksResult, profileResult] = await Promise.all([
        supabase
          .from('tasks')
          .select('*')
          .eq('profile_id', userId)
          .order('order_index', { ascending: true }),
        supabase
          .from('profiles')
          .select('job_roles(name)')
          .eq('id', userId)
          .single(),
      ])

      if (!active) return
      if (tasksResult.error) { setError(tasksResult.error.message); setLoading(false); return }
      setTasks(tasksResult.data ?? [])

      // job_roles is a nested object when the FK resolves; null when no role assigned
      const pr = profileResult.data as { job_roles: { name: string } | null } | null
      setJobRoleName(pr?.job_roles?.name ?? undefined)

      setLoading(false)
    })
    return () => { active = false }
  }, [supabase])

  const toggle = useCallback(async (task: Task) => {
    const newStatus: 'pending' | 'done' = task.status === 'done' ? 'pending' : 'done'

    // Optimistic update
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    setToggling(s => new Set(s).add(task.id))

    const { error: e } = await toggleTaskStatus(task.id, newStatus)

    setToggling(s => { const n = new Set(s); n.delete(task.id); return n })

    if (e) {
      // Roll back on error
      setTasks(ts => ts.map(t => t.id === task.id ? { ...t, status: task.status } : t))
      setError(e)
    }
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--color-ink-muted)', fontSize: 13 }}>
        Loading tasks…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '24px', fontSize: 13, color: 'var(--color-incorrect)' }}>
        {error}
      </div>
    )
  }

  // ── bar view ────────────────────────────────────────────────────────────────
  // Profile page: segmented bar card only.

  if (view === 'bar') {
    if (tasks.length === 0) {
      return (
        <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>
          No tasks assigned yet.
        </p>
      )
    }
    return <TaskBar tasks={tasks} jobRoleName={jobRoleName} />
  }

  // ── checklist view (default) ────────────────────────────────────────────────
  // Tasks tab: heading + tickable rows; no bar.

  if (tasks.length === 0) {
    return (
      <div
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '48px 32px', gap: 10, textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>
          No tasks assigned yet
        </p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-muted)', lineHeight: 1.6 }}>
          Your supervisor hasn&rsquo;t set up your onboarding tasks yet. Check back soon.
        </p>
      </div>
    )
  }

  function scrollToTask(index: number) {
    rowRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--color-page)' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600 }}>Your tasks</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-muted)' }}>
            Go at your own pace — tick each item off as you complete it.
          </p>
        </div>

        {/* Task list — no bar here */}
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          {tasks.map((task, idx) => {
            const done       = task.status === 'done'
            const isToggling = toggling.has(task.id)

            return (
              <div
                key={task.id}
                ref={el => { rowRefs.current[idx] = el }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '14px 20px',
                  borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)',
                  opacity: isToggling ? 0.6 : 1,
                  transition: 'opacity 150ms',
                }}
              >
                {/* Checkbox */}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={done ? `Mark "${task.title}" as pending` : `Mark "${task.title}" as done`}
                  onClick={() => toggle(task)}
                  disabled={isToggling}
                  style={{
                    flexShrink: 0, marginTop: 1,
                    width: 22, height: 22, borderRadius: 6, border: 'none',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? 'var(--color-accent)' : 'transparent',
                    outline: done ? 'none' : '1.5px solid var(--color-border)',
                    transition: 'background 150ms',
                  }}
                >
                  {done && <Check size={12} strokeWidth={3} color="#fff" />}
                </button>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500,
                    color: done ? 'var(--color-ink-muted)' : 'var(--color-ink)',
                    textDecoration: done ? 'line-through' : 'none',
                  }}>
                    {task.title}
                  </div>
                  {task.description && (
                    <div style={{ fontSize: 12, color: 'var(--color-ink-muted)', marginTop: 3, lineHeight: 1.5 }}>
                      {task.description}
                    </div>
                  )}
                  {done && task.completed_at && (
                    <div style={{ fontSize: 11, color: 'var(--color-ink-muted)', marginTop: 4 }}>
                      Completed {new Date(task.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
