/**
 * components/console/AskBar.tsx
 * Sidebar input that replaces a browsable topic list.
 * Type a question → Compass resolves it to one answer.
 */
'use client'

import { FormEvent, useState } from 'react'
import { Search } from 'lucide-react'

interface AskBarProps {
  onAsk:   (query: string) => void
  asking?: boolean
}

export default function AskBar({ onAsk, asking = false }: AskBarProps) {
  const [value, setValue] = useState('')

  const submit = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed || asking) return
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
          padding:    '24px 28px 12px',
          flexShrink: 0,
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
            disabled={asking}
            className="btn-primary"
            style={{
              width:      '100%',
              marginTop:  12,
              opacity:    asking ? 0.45 : 1,
              cursor:     asking ? 'not-allowed' : 'pointer',
              color:      asking ? 'var(--color-ink-muted)' : undefined,
              background: asking ? 'var(--color-sunk)'      : undefined,
            }}
          >
            {asking ? 'Asking…' : 'Ask'}
          </button>
        </form>
      </div>
    </div>
  )
}
