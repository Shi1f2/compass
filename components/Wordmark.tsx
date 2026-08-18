/**
 * components/Wordmark.tsx
 * Brand lockup for Compass.
 */
'use client'

// ─── Tagline constant ─────────────────────────────────────────────────────────

export const TAGLINE = 'find your bearings'

// ─── Mark ─────────────────────────────────────────────────────────────────────

interface MarkProps {
  size?: number
  fill?: string
}

export function Mark({ size = 18, fill }: MarkProps) {
  const borderWidth = Math.max(1.5, size * 0.085)
  const side        = size * 0.36
  const bg          = fill ?? 'var(--color-accent)'

  return (
    <span
      aria-hidden="true"
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        width:          size,
        height:         size,
        borderRadius:   '50%',
        background:     bg,
        flexShrink:     0,
      }}
    >
      <span
        style={{
          display:      'inline-block',
          width:        side,
          height:       side,
          borderRadius: '1px',
          border:       `${borderWidth}px solid #fff`,
          transform:    'rotate(45deg)',
        }}
      />
    </span>
  )
}

// ─── Wordmark text ─────────────────────────────────────────────────────────────

interface WordmarkProps {
  color?: string
  size?: number
  weight?: number
}

export function Wordmark({ color, size, weight }: WordmarkProps) {
  return (
    <span
      style={{
        fontFamily:    'var(--font-sans)',
        letterSpacing: '-0.015em',
        whiteSpace:    'nowrap',
        color:         color ?? 'inherit',
        fontSize:      size  ? `${size}px`  : undefined,
        fontWeight:    weight ?? undefined,
        lineHeight:    1,
      }}
    >
      Compass
    </span>
  )
}

// ─── Lockup ───────────────────────────────────────────────────────────────────

interface LockupProps {
  size?:        'large' | 'small'
  layout?:      'stacked' | 'inline'
  wordColor?:   string
  markFill?:    string
  taglineColor?: string
  markSize?:    number
}

export function Lockup({
  size    = 'large',
  layout  = 'stacked',
  wordColor,
  markFill,
  taglineColor,
  markSize,
}: LockupProps) {
  const isLarge = size === 'large'
  const ms      = markSize ?? (isLarge ? 22 : 18)
  const wordSz  = isLarge ? 26 : 13
  const tagSz   = isLarge ? 12 : 11
  const tagLS   = isLarge ? '0.14em' : '0.12em'
  const tc      = taglineColor ?? 'var(--color-ink-muted)'

  if (layout === 'inline') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Mark size={ms} fill={markFill} />
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
          <Wordmark color={wordColor} size={wordSz} weight={600} />
          <span
            style={{
              fontSize:      tagSz,
              letterSpacing: tagLS,
              textTransform: 'uppercase',
              color:         tc,
              fontFamily:    'var(--font-sans)',
            }}
          >
            {TAGLINE}
          </span>
        </span>
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <Mark size={ms} fill={markFill} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Wordmark color={wordColor} size={wordSz} weight={600} />
        <span
          style={{
            fontSize:      tagSz,
            letterSpacing: tagLS,
            textTransform: 'uppercase',
            color:         tc,
            fontFamily:    'var(--font-sans)',
          }}
        >
          {TAGLINE}
        </span>
      </div>
    </div>
  )
}
