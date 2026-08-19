/**
 * components/console/GuideAnswer.tsx
 * Renders a live "Ask Compass" answer as ordered steps. Each step is one line of
 * text; if the model chose a screenshot for that step, it sits directly under
 * the text — so the words and the picture always stay together.
 */
'use client'

import { useState } from 'react'
import { FileDown, RefreshCw } from 'lucide-react'
import type { AnswerStep } from '@/lib/guideTypes'

// Render **bold** inline; everything else is plain text.
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>,
  )
}

function StepCard({ step, index }: { step: AnswerStep; index: number }) {
  const [broken, setBroken] = useState(false)
  const showImage = step.image && !broken

  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--color-violet-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: 1,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-violet)' }}>{index + 1}</span>
        </div>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--color-ink)' }}>
          {renderInline(step.text)}
        </p>
      </div>
      {showImage && (
        <div style={{ borderRadius: 12, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={step.image!.src}
            alt={step.image!.alt}
            onError={() => setBroken(true)}
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
        </div>
      )}
    </div>
  )
}

interface GuideAnswerProps {
  query:      string
  steps:      AnswerStep[]
  onReport:   () => void
  onAskAgain: () => void
}

export default function GuideAnswer({ query, steps, onReport, onAskAgain }: GuideAnswerProps) {
  return (
    <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '36px 32px' }}>
        {/* Query */}
        <span className="section-label">You asked</span>
        <h2 style={{ margin: '8px 0 28px', fontSize: 20, fontWeight: 600, lineHeight: 1.2, color: 'var(--color-ink)' }}>
          {query}
        </h2>

        {/* Steps: text + its screenshot together */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {steps.map((s, i) => <StepCard key={i} step={s} index={i} />)}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            onClick={onAskAgain}
          >
            <RefreshCw size={15} />
            Ask again
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            onClick={onReport}
          >
            <FileDown size={15} />
            Report
          </button>
        </div>
      </div>
    </div>
  )
}
