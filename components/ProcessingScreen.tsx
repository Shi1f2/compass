/**
 * components/ProcessingScreen.tsx
 *
 * Shown on first sign-in of a session while real data loads.
 *
 * Layout (vertically centred, full-screen):
 *   1. /clean.png illustration — 320 px wide, height auto, no card/border
 *   2. Progress bar — 560 px wide, 6 px tall, fills left-to-right over MIN_MS
 *   3. Caption — "FirstName · current step label…"
 *
 * Timing:
 *   - Bar advances in equal slices across MIN_MS (3 s by default).
 *   - Each slice label switches when its segment starts.
 *   - onDone fires only once BOTH the timer AND all `steps[].work` promises
 *     have settled.
 *
 * The step labels are honest: they name what is genuinely happening, not
 * invented system connections.
 */
'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessingStep {
  /** Short label shown in the caption, e.g. "Loading your tasks" */
  label: string
  /** The real async work for this step. Bar advances regardless of its speed. */
  work:  Promise<void>
}

interface ProcessingScreenProps {
  firstName: string
  steps:     ProcessingStep[]
  onDone:    () => void
  /** Minimum display duration in milliseconds. Default: 3000. */
  minMs?:    number
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProcessingScreen({
  firstName,
  steps,
  onDone,
  minMs = 3000,
}: ProcessingScreenProps) {
  const [stepIndex,  setStepIndex]  = useState(0)
  const [barPct,     setBarPct]     = useState(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (steps.length === 0) {
      const t = window.setTimeout(() => onDoneRef.current(), minMs)
      return () => clearTimeout(t)
    }

    const n         = steps.length
    const sliceMs   = minMs / n        // each segment gets an equal slice of the total
    const timers: number[] = []
    let timerDone   = false
    let workDone    = false

    function tryDone() {
      if (timerDone && workDone) onDoneRef.current()
    }

    // Advance the step label at each slice boundary.
    for (let i = 1; i < n; i++) {
      const delay = i * sliceMs
      timers.push(window.setTimeout(() => setStepIndex(i), delay))
    }

    // CSS transition drives the bar fill smoothly. We trigger it after one
    // rAF so the browser has painted the initial 0% width before transitioning.
    const raf = requestAnimationFrame(() => setBarPct(100))

    // Timer gate
    timers.push(window.setTimeout(() => {
      timerDone = true
      tryDone()
    }, minMs))

    // Work gate — all steps must settle (fulfilled or rejected)
    Promise.allSettled(steps.map(s => s.work)).then(() => {
      workDone = true
      tryDone()
    })

    return () => {
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
    }
    // steps array identity must not change — it's constructed once from stable promises
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minMs])

  const label = steps[stepIndex]?.label ?? ''

  return (
    <main
      style={{
        minHeight:       '100vh',
        backgroundColor: 'var(--color-page)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
      }}
    >
      <div
        style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           0,
          padding:       '0 24px',
          width:         '100%',
        }}
      >
        {/* Illustration — line drawing on transparent bg: no card/border/shadow */}
        <Image
          src="/clean.png"
          alt=""
          width={320}
          height={320}
          style={{ width: 320, height: 'auto' }}
          priority
          draggable={false}
        />

        {/* Progress track */}
        <div
          className="track"
          style={{ width: '100%', maxWidth: 560, height: 6, marginTop: 40 }}
        >
          <div
            className="track-fill"
            style={{
              width:      `${barPct}%`,
              height:     '100%',
              transition: barPct > 0 ? `width ${minMs}ms linear` : 'none',
            }}
          />
        </div>

        {/* Caption */}
        {label && (
          <p
            style={{
              marginTop:  14,
              fontSize:   11,
              lineHeight: 1.5,
              color:      'var(--color-ink-muted)',
              textAlign:  'center',
            }}
          >
            {firstName} &middot; {label}&hellip;
          </p>
        )}
      </div>
    </main>
  )
}
