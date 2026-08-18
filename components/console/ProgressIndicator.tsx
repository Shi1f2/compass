/**
 * components/console/ProgressIndicator.tsx
 * Plain onboarding-completion bar shown in the new-starter header.
 * One track, one percentage — nothing else.
 */
'use client'

interface ProgressIndicatorProps {
  pct: number
}

export default function ProgressIndicator({ pct }: ProgressIndicatorProps) {
  return (
    <div
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        8,
        flexShrink: 1,
        minWidth:   0,
      }}
    >
      <div
        className="track"
        style={{ width: 80, height: 8, flexShrink: 0 }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Onboarding progress"
      >
        <div
          className="track-fill"
          style={{ width: `${pct}%`, height: '100%' }}
        />
      </div>
      <span
        style={{
          fontSize:           11,
          color:              'var(--color-ink-muted)',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace:         'nowrap',
        }}
      >
        {pct}%
      </span>
    </div>
  )
}
