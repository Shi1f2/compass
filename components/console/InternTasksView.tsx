/**
 * components/console/InternTasksView.tsx
 * Supervisor read-only view of one intern's tasks.
 * Displayed in the intern detail panel.
 */
'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Task } from '@/lib/database.types'
import TaskBar from './TaskBar'

interface InternTasksViewProps {
  profileId: string
}

export default function InternTasksView({ profileId }: InternTasksViewProps) {
  const supabase = createClient()
  const [tasks,       setTasks]       = useState<Task[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [jobRoleName, setJobRoleName] = useState<string | undefined>(undefined)

  useEffect(() => {
    let active = true

    Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('profile_id', profileId)
        .order('order_index', { ascending: true }),
      supabase
        .from('profiles')
        .select('job_roles(name)')
        .eq('id', profileId)
        .single(),
    ]).then(([tasksResult, profileResult]) => {
      if (!active) return
      if (tasksResult.error) { setError(tasksResult.error.message); setLoading(false); return }
      setTasks(tasksResult.data ?? [])

      const pr = profileResult.data as { job_roles: { name: string } | null } | null
      setJobRoleName(pr?.job_roles?.name ?? undefined)

      setLoading(false)
    })

    return () => { active = false }
  }, [profileId, supabase])

  if (loading) {
    return <p style={{ padding: '20px 0', fontSize: 13, color: 'var(--color-ink-muted)' }}>Loading tasks…</p>
  }

  if (error) {
    return <p style={{ padding: '20px 0', fontSize: 13, color: 'var(--color-incorrect)' }}>{error}</p>
  }

  if (tasks.length === 0) {
    return (
      <p style={{ padding: '20px 0', fontSize: 13, color: 'var(--color-ink-muted)' }}>
        No tasks assigned yet.
      </p>
    )
  }

  return (
    <div>
      {/* Segmented progress bar — read-only for supervisor */}
      <TaskBar tasks={tasks} jobRoleName={jobRoleName} />

      {/* Task rows */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        {tasks.map((task, idx) => {
          const done = task.status === 'done'
          return (
            <div
              key={task.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 16px',
                borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)',
              }}
            >
              {/* Status indicator */}
              <div style={{
                flexShrink: 0,
                width: 20, height: 20, borderRadius: 5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--color-accent)' : 'transparent',
                outline: done ? 'none' : '1.5px solid var(--color-border)',
              }}>
                {done && <Check size={11} strokeWidth={3} color="#fff" />}
              </div>

              <span style={{
                flex: 1, fontSize: 13,
                color: done ? 'var(--color-ink-muted)' : 'var(--color-ink)',
                textDecoration: done ? 'line-through' : 'none',
              }}>
                {task.title}
              </span>

              {done && task.completed_at && (
                <span style={{ fontSize: 11, color: 'var(--color-ink-muted)', flexShrink: 0 }}>
                  {new Date(task.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
