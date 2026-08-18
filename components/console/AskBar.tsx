/**
 * components/console/AskBar.tsx
 * Sidebar input that replaces a browsable topic list.
 * Type a question → Compass resolves it to one answer.
 */
'use client'

import { FormEvent, useState } from 'react'
import { Search } from 'lucide-react'

const SUGGESTIONS = [
  'Laptop setup',
  'Time off',
  'Expenses',
  'VPN access',
  'Benefits',
  'Who do I ask?',
]

// Chip tones cycle every 3 by index
const CHIP_TONES = [
  {
    bg:    'var(--color-violet-soft)',
    text:  'var(--color-violet)',
    hoverBg:   'var(--color-violet)',
    hoverText: '#fff',
  },
  {
    bg:    'var(--color-yellow-soft)',
    text:  'var(--color-waiting)',
    hoverBg:   'var(--color-yellow)',
    hoverText: 'var(--color-ink)',
  },
  {
    bg:    'var(--color-accent-soft)',
    text:  'var(--color-accent)',
    hoverBg:   'var(--color-accent)',
    hoverText: '#fff',
  },
]

interface AskBarProps {
  onAsk: (query: string) => void
}

export default function AskBar({ onAsk }: AskBarProps) {
  const [value, setValue] = useState('')
  const [hoveredChip, setHoveredChip] = useState<number | null>(null)

  const submit = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setValue(trimmed)
    onAsk(trimmed)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit(value)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding:       '24px 28px 12px',
          flexShrink:    0,
        }}
      >
        <span className="section-label">Ask Compass</span>
      </div>

      {/* Form */}
      <div style={{ padding: '0 28px 28px', flexShrink: 0 }}>
        <form onSubmit={handleSubmit}>
          {/* Input row with focus ring */}
          <label
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          10,
              padding:      '12px 16px',
              borderRadius: 14,
              border:       '1px solid var(--color-border)',
              background:   'var(--color-surface)',
              boxSizing:    'border-box',
              width:        '100%',
            }}
            className="ask-bar-field"
          >
            <Search size={16} strokeWidth={1.8} color="var(--color-ink-muted)" style={{ flexShrink: 0 }} />
            <input
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="Type your question…"
              aria-label="Ask Compass a question"
              style={{
                flex:       1,
                border:     'none',
                outline:    'none',
                background: 'transparent',
                fontSize:   13,
                color:      'var(--color-ink)',
                minWidth:   0,
              }}
            />
          </label>
          <style>{`
            .ask-bar-field:focus-within {
              border-color: var(--color-accent) !important;
              box-shadow: 0 0 0 4px var(--color-accent-soft);
            }
          `}</style>
          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: 12 }}
          >
            Ask
          </button>
        </form>
      </div>

      {/* Suggestions */}
      <div style={{ padding: '0 28px', flexShrink: 0 }}>
        <span className="section-label">Try asking about</span>
        <div
          style={{
            display:   'flex',
            flexWrap:  'wrap',
            gap:       8,
            marginTop: 12,
          }}
        >
          {SUGGESTIONS.map((s, i) => {
            const tone    = CHIP_TONES[i % 3]!
            const hovered = hoveredChip === i
            return (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                onMouseEnter={() => setHoveredChip(i)}
                onMouseLeave={() => setHoveredChip(null)}
                style={{
                  padding:       '6px 14px',
                  borderRadius:  9999,
                  border:        'none',
                  cursor:        'pointer',
                  fontSize:      12,
                  fontWeight:    500,
                  background:    hovered ? tone.hoverBg   : tone.bg,
                  color:         hovered ? tone.hoverText : tone.text,
                  transition:    'background 150ms, color 150ms',
                  fontFamily:    'var(--font-sans)',
                }}
              >
                {s}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
