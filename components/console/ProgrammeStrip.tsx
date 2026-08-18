/**
 * components/console/ProgrammeStrip.tsx
 * Horizontal timeline of onboarding topics, laid out proportionally by day span.
 *
 * Layout choice: each pill grows with its day range, but segments are laid out
 * sequentially rather than positioned absolutely by start day. On a 90-day
 * programme most items span one to four days, and absolute placement plus a
 * legibility floor made short neighbours overlap — the later one painting over
 * the selected one so the current item looked unselected. Growing them in
 * proportion keeps the ratios and makes overlap impossible.
 */
'use client'

import { useState } from 'react'
import { phaseLabel } from '@/lib/format'

// ─── Exported item shape ──────────────────────────────────────────────────────

export interface StripItem {
  id:    string
  title: string
  start: number
  end:   number
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProgrammeStripProps {
  items:        StripItem[]
  totalDays:    number
  selectedId:   string
  onSelect:     (id: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProgrammeStrip({
  items, totalDays, selectedId, onSelect,
}: ProgrammeStripProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const scheduledDays = items.reduce((s, it) => s + Math.max(1, it.end - it.start), 0)
  const spacerSpan    = Math.max(0, totalDays - scheduledDays)
  const noun          = items.length === 1 ? 'topic' : 'topics'

  return (
    <div className="card" style={{ marginTop: 20, padding: 28 }}>
      {/* Header */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginBottom:   16,
        }}
      >
        <span className="section-label">Onboarding programme</span>
        <span style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>
          {items.length} {noun} &middot; {totalDays} days
        </span>
      </div>

      {/* Track */}
      <div
        style={{
          display:       'flex',
          alignItems:    'stretch',
          gap:           4,
          background:    'var(--color-sunk)',
          borderRadius:  9999,
          height:        40,
          padding:       '6px 6px',
          width:         '100%',
          overflowX:     'auto',
        }}
      >
        {items.map((item, idx) => {
          const span    = Math.max(1, item.end - item.start)
          const isSelected = item.id === selectedId
          const isHovered  = hoveredId === item.id
          const showNum    = span > 2
          return (
            <button
              key={item.id}
              role="option"
              aria-selected={isSelected}
              aria-current={isSelected ? 'true' : undefined}
              aria-label={`Item ${idx + 1}: ${item.title}, starts day ${item.start + 1}`}
              title={`${idx + 1}. ${item.title} — Day ${item.start + 1}`}
              onClick={() => onSelect(item.id)}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                flex:          `${span} 0 0`,
                minWidth:      16,
                borderRadius:  9999,
                border:        'none',
                cursor:        'pointer',
                background:    isSelected
                  ? 'var(--color-accent)'
                  : isHovered
                    ? 'color-mix(in srgb, var(--color-violet) 75%, transparent)'
                    : 'var(--color-violet)',
                color:         '#fff',
                display:       'flex',
                alignItems:    'center',
                justifyContent:'center',
                transition:    'background 150ms',
                padding:       0,
              }}
            >
              {showNum && (
                <span
                  style={{
                    fontSize:           11,
                    fontWeight:         600,
                    fontVariantNumeric: 'tabular-nums',
                    pointerEvents:      'none',
                  }}
                >
                  {idx + 1}
                </span>
              )}
            </button>
          )
        })}
        {/* Spacer for unscheduled portion */}
        {spacerSpan > 0 && (
          <div
            aria-hidden="true"
            style={{
              flex:          `${spacerSpan} 0 0`,
              minWidth:      0,
              borderRadius:  9999,
            }}
          />
        )}
      </div>

      {/* Phase labels */}
      <div
        style={{
          display:        'flex',
          justifyContent: 'space-between',
          marginTop:      12,
          fontSize:       11,
          color:          'var(--color-ink-muted)',
        }}
      >
        <span>{phaseLabel(0)}</span>
        <span>{phaseLabel(Math.floor(totalDays / 2))}</span>
        <span>Ongoing</span>
      </div>
    </div>
  )
}
