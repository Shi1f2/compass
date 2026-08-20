/**
 * components/console/TaskBar.tsx
 * Segmented progress bar for a flat task list.
 *
 * - One segment per task, in order_index order (caller sorts before passing).
 * - Done: --color-violet (full). Pending: a mid-tone violet that sits clearly
 *   above the card background so every division is legible at 0% done.
 * - Each segment shows its 1-based position index.
 * - Clicking a segment calls onSegmentClick(index) so the caller can scroll to
 *   the matching task row.
 * - With zero tasks: returns null so the parent renders its own empty state.
 */

import type { Task } from '@/lib/database.types'

// Pending fill: noticeably darker than the card surface (#fff) so that
// segment gaps (which show the card background) are visible even when every
// task is pending. Full --color-violet (#b08cf7) is used for done segments.
const PENDING_BG = '#d6c4fd'   // ~midpoint between --color-violet-soft and --color-violet
const DONE_BG    = '#b08cf7'   // --color-violet
const DONE_HOVER = '#9a72f5'   // slightly deeper
const PEND_HOVER = '#c4aefc'

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskBarProps {
  tasks:           Task[]
  /** Shown in the header — the intern's job role name. Falls back to "Tasks". */
  jobRoleName?:    string
  /** Called with the 0-based index of the clicked segment. Optional. */
  onSegmentClick?: (index: number) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TaskBar({ tasks, jobRoleName, onSegmentClick }: TaskBarProps) {
  if (tasks.length === 0) return null

  const doneCount  = tasks.filter(t => t.status === 'done').length
  const totalCount = tasks.length
  const roleName   = jobRoleName ?? 'Tasks'

  return (
    <div
      className="card"
      style={{ padding: '20px 24px', marginBottom: 24 }}
      aria-label={`${roleName} task progress: ${doneCount} of ${totalCount} done`}
    >
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>
          {roleName}
        </span>
        <span style={{
          fontSize: 12, color: 'var(--color-ink-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {totalCount} task{totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Segmented bar
          The wrapping div has the card background (white) so the 6px gaps
          between segments show as crisp white dividers at any completion state. */}
      <div
        role="group"
        aria-label="Task progress segments"
        style={{
          display: 'flex', alignItems: 'stretch', gap: 6,
          height: 32,
          background: 'var(--color-surface)',
          borderRadius: 9999,
          padding: '4px 4px',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
        {tasks.map((task, idx) => {
          const done      = task.status === 'done'
          const bg        = done ? DONE_BG : PENDING_BG
          const hoverBg   = done ? DONE_HOVER : PEND_HOVER
          // Labels need to be readable on both fills: white works on the mid-
          // and full violet; use a slightly-opaque white for visibility.
          const isClickable = !!onSegmentClick

          return (
            <button
              key={task.id}
              type="button"
              role="option"
              aria-selected={done}
              aria-label={`Task ${idx + 1}: ${task.title} — ${done ? 'Done' : 'Not started'}`}
              title={`${idx + 1}. ${task.title}`}
              onClick={isClickable ? () => onSegmentClick(idx) : undefined}
              style={{
                flex: '1 0 0',
                minWidth: 12,
                borderRadius: 9999,
                border: 'none',
                cursor: isClickable ? 'pointer' : 'default',
                background: bg,
                transition: 'background 120ms',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={isClickable ? e => {
                (e.currentTarget as HTMLButtonElement).style.background = hoverBg
              } : undefined}
              onMouseLeave={isClickable ? e => {
                (e.currentTarget as HTMLButtonElement).style.background = bg
              } : undefined}
            >
              <span
                aria-hidden="true"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'rgba(255,255,255,0.9)',
                  pointerEvents: 'none',
                  lineHeight: 1,
                  userSelect: 'none',
                }}
              >
                {idx + 1}
              </span>
            </button>
          )
        })}
      </div>

      {/* Count line */}
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-ink-muted)' }}>
        {doneCount} of {totalCount} task{totalCount !== 1 ? 's' : ''} done
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <LegendDot color={DONE_BG}    label="Done"        />
        <LegendDot color={PENDING_BG} label="Not started" />
      </div>
    </div>
  )
}

// ─── Legend dot ───────────────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        aria-hidden="true"
        style={{
          width: 10, height: 10, borderRadius: '50%',
          background: color, flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>{label}</span>
    </div>
  )
}
