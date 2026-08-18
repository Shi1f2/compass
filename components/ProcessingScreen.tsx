/**
 * components/ProcessingScreen.tsx
 * Fake "connecting to your systems" screen shown between sign-in and the
 * console. Nothing is actually connected — the profile was hardcoded in
 * lib/data.ts.
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import type { Profile } from '@/lib/types'

// ─── Stage definitions ────────────────────────────────────────────────────────

const STAGES = [
  { label: 'Verifying identity',               duration: 0.25 },
  { label: 'Reading HR record',                duration: 0.40 },
  { label: 'Connecting IT service desk',       duration: 0.50 },
  { label: 'Indexing document store & wiki',   duration: 0.40 },
  { label: 'Linking project & comms tools',    duration: 0.50 },
  { label: 'Scoping answers to this profile',  duration: 0.35 },
]

const TOTAL = STAGES.reduce((s, st) => s + st.duration, 0) // 2.4 s

// Precompute start offsets (in ms)
const STAGE_STARTS = STAGES.reduce<number[]>((acc, st, i) => {
  acc.push(i === 0 ? 0 : (acc[i - 1]! + STAGES[i - 1]!.duration * 1000))
  return acc
}, [])

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProcessingScreenProps {
  profile: Profile
  onDone:  () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProcessingScreen({ profile, onDone }: ProcessingScreenProps) {
  const [stageLabel, setStageLabel] = useState(STAGES[0]!.label)
  const fillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Drive the fill bar with a CSS width transition — the browser's compositor
    // animates it smoothly without JavaScript per-frame callbacks.
    const frame = requestAnimationFrame(() => {
      if (fillRef.current) {
        fillRef.current.style.width = '100%'
      }
    })

    // One timer per stage to advance the label — six updates total.
    const stageTimers = STAGE_STARTS.map((start, i) =>
      i === 0
        ? undefined
        : window.setTimeout(() => setStageLabel(STAGES[i]!.label), start),
    ).filter(Boolean) as number[]

    // One timer at the total duration to fire the done callback.
    const doneTimer = window.setTimeout(onDone, TOTAL * 1000)

    return () => {
      cancelAnimationFrame(frame)
      stageTimers.forEach(clearTimeout)
      clearTimeout(doneTimer)
    }
  }, [onDone])

  const firstName = profile.persona.name.split(' ')[0] ?? profile.persona.name

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
          width:         '100%',
          maxWidth:      420,
          padding:       '0 24px',
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'stretch',
          gap:           0,
        }}
      >
        {/* Brand image — clean.png placed in /public by the user */}
        {/* alt is intentionally empty: it is decorative; the stage line below says what is happening */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/clean.png"
          alt=""
          draggable={false}
          style={{
            display:    'block',
            width:      '100%',
            userSelect: 'none',
          }}
        />

        {/* Progress track */}
        <div
          className="track"
          style={{ height: 8, marginTop: 40 }}
        >
          <div
            ref={fillRef}
            className="track-fill"
            style={{
              width:      '0%',
              height:     '100%',
              transition: `width ${TOTAL}s linear`,
            }}
          />
        </div>

        {/* Stage label */}
        <p
          style={{
            marginTop:  16,
            fontSize:   11,
            lineHeight: 1.5,
            color:      'var(--color-ink-muted)',
            textAlign:  'center',
          }}
        >
          {firstName} &middot; {stageLabel}&hellip;
        </p>
      </div>
    </main>
  )
}
