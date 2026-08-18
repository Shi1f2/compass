/**
 * components/console/PeekCarousel.tsx
 * Shell shared by the Mentor step view and the Tutor question view.
 * Previous/next slides peek in at the edges; navigable by drag, trackpad
 * swipe, arrow keys, arrow buttons, or clicking a neighbour.
 */
'use client'

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// ─── Tuning ───────────────────────────────────────────────────────────────────

const DRAG_THRESHOLD   = 60      // px — minimum drag to flip slide
const WHEEL_THRESHOLD  = 40      // px — accumulated delta to flip slide
const WHEEL_LOCK_MS    = 350     // ms — cooldown after a wheel-triggered flip
const SLIDE_TRANSITION = '250ms ease-out'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PeekCarouselProps {
  count:       number
  active:      number
  onChange:    (i: number) => void
  renderSlide: (i: number, isActive: boolean) => React.ReactNode
  slideLabel:  (i: number) => string
  announce:    (i: number) => string
  ariaLabel:   string
  dots?:       boolean
  dotLabel?:   (i: number) => string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PeekCarousel({
  count, active, onChange,
  renderSlide, slideLabel, announce, ariaLabel,
  dots = false, dotLabel,
}: PeekCarouselProps) {

  const [dragOffset,   setDragOffset]   = useState(0)
  const [isDragging,   setIsDragging]   = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  const viewportRef   = useRef<HTMLDivElement>(null)
  const dragStart     = useRef(0)
  const dragId        = useRef<number | null>(null)
  const dragStarted   = useRef(false)   // has pointer moved >6px yet?
  const wasDrag       = useRef(false)   // was this pointer-sequence a drag?
  const wheelAccum    = useRef(0)
  const wheelLocked   = useRef(false)
  const liveRef       = useRef<HTMLDivElement>(null)

  // ── Reduced-motion preference ─────────────────────────────────────────────

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── Navigation helpers ────────────────────────────────────────────────────

  const clamp = useCallback((i: number) => Math.max(0, Math.min(count - 1, i)), [count])

  const go = useCallback((i: number) => {
    const next = clamp(i)
    if (next !== active) onChange(next)
  }, [active, clamp, onChange])

  // ── Live region ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (liveRef.current) liveRef.current.textContent = announce(active)
  }, [active, announce])

  // ── Wheel handling (non-passive to prevent page scroll) ──────────────────

  useEffect(() => {
    if (count <= 1) return
    const el = viewportRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      // Ignore events dominated by vertical movement
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) return
      e.preventDefault()
      if (wheelLocked.current) return
      wheelAccum.current += e.deltaX
      if (Math.abs(wheelAccum.current) >= WHEEL_THRESHOLD) {
        const dir = wheelAccum.current > 0 ? 1 : -1
        go(active + dir)
        wheelAccum.current = 0
        wheelLocked.current = true
        setTimeout(() => { wheelLocked.current = false }, WHEEL_LOCK_MS)
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [count, active, go])

  // ── Pointer drag ─────────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (count <= 1 || e.button !== 0) return
    dragStart.current   = e.clientX
    dragId.current      = e.pointerId
    dragStarted.current = false
    wasDrag.current     = false
  }, [count])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragId.current !== e.pointerId) return
    const delta = e.clientX - dragStart.current
    if (!dragStarted.current && Math.abs(delta) > 6) {
      dragStarted.current = true
      // Capture only once we know this is a drag, not a click.
      // Grabbing the pointer on every pointer-down — before we know direction
      // — re-targets the resulting pointerup click to the container instead of
      // the element actually pressed (e.g. a button inside a card), breaking it.
      ;(e.target as Element).setPointerCapture(e.pointerId)
      setIsDragging(true)
      wasDrag.current = true
    }
    if (dragStarted.current) setDragOffset(delta)
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragId.current !== e.pointerId) return
    if (dragStarted.current) {
      const vw    = window.innerWidth
      const limit = Math.max(DRAG_THRESHOLD, vw * 0.12)
      if (dragOffset >  limit) go(active - 1)
      else if (dragOffset < -limit) go(active + 1)
    }
    dragStart.current   = 0
    dragId.current      = null
    dragStarted.current = false
    setDragOffset(0)
    setIsDragging(false)
  }, [active, dragOffset, go])

  // ── Keyboard ─────────────────────────────────────────────────────────────

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); go(active - 1) }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1) }
  }, [active, go])

  // ── Bleed width ───────────────────────────────────────────────────────────

  // 84% below md, 70% from md up — via CSS variable set in the style attribute
  const bleedStyle: React.CSSProperties = {
    '--bleed': '84%',
  } as React.CSSProperties

  // ── Single-slide shortcut ─────────────────────────────────────────────────

  if (count <= 1) {
    return (
      <div style={{ width: '100%' }}>
        {renderSlide(0, true)}
      </div>
    )
  }

  const transition = (!isDragging && !reducedMotion)
    ? `transform ${SLIDE_TRANSITION}, opacity ${SLIDE_TRANSITION}`
    : 'none'

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* ── Responsive bleed style ─ */}
      <style>{`
        .peek-carousel-viewport { touch-action: pan-y; }
        @media (min-width: 768px) {
          .peek-carousel-inner  { padding-left: 44px; padding-right: 44px; }
          .peek-btn-prev, .peek-btn-next { display: flex !important; }
          .peek-carousel-slide  { --bleed: 70%; }
        }
      `}</style>

      {/* ── Inner wrapper (gives room for arrow buttons on md+) ── */}
      <div className="peek-carousel-inner" style={{ position: 'relative' }}>

        {/* Prev button */}
        <button
          className="peek-btn-prev btn-icon"
          aria-label="Previous"
          onClick={() => go(active - 1)}
          disabled={active === 0}
          style={{
            display:    'none',
            position:   'absolute',
            left:       0,
            top:        '50%',
            transform:  'translateY(-50%)',
            zIndex:     10,
            width:      40,
            height:     40,
            boxShadow:  'var(--shadow-card)',
            opacity:    active === 0 ? 0.2 : 1,
            pointerEvents: active === 0 ? 'none' : 'auto',
          }}
        >
          <ChevronLeft size={18} />
        </button>

        {/* Next button */}
        <button
          className="peek-btn-next btn-icon"
          aria-label="Next"
          onClick={() => go(active + 1)}
          disabled={active === count - 1}
          style={{
            display:    'none',
            position:   'absolute',
            right:      0,
            top:        '50%',
            transform:  'translateY(-50%)',
            zIndex:     10,
            width:      40,
            height:     40,
            boxShadow:  'var(--shadow-card)',
            opacity:    active === count - 1 ? 0.2 : 1,
            pointerEvents: active === count - 1 ? 'none' : 'auto',
          }}
        >
          <ChevronRight size={18} />
        </button>

        {/* ── Viewport ── */}
        <div
          ref={viewportRef}
          className="peek-carousel-viewport"
          role="region"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          style={{
            position:   'relative',
            display:    'grid',
            overflow:   'hidden',
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          {Array.from({ length: count }, (_, i) => {
            const dist = i - active
            if (Math.abs(dist) > 2) return null

            const isActive = dist === 0
            const opacity  = isActive ? 1 : Math.abs(dist) === 1 ? 0.4 : 0
            const zIndex   = isActive ? 3 : Math.abs(dist) === 1 ? 2 : 1
            const scale    = isActive ? 1 : 0.92
            const tx       = dist * 100   // percentage-of-viewport offset
            const noPtr    = Math.abs(dist) > 1

            return (
              <div
                key={i}
                role="group"
                aria-roledescription="slide"
                aria-label={slideLabel(i)}
                aria-current={isActive ? 'true' : undefined}
                aria-hidden={isActive ? undefined : 'true'}
                onClick={() => {
                  if (!wasDrag.current && !isActive) go(i)
                }}
                style={{
                  gridColumn:  1,
                  gridRow:     1,
                  display:     'flex',
                  justifyContent: 'center',
                  width:       'var(--bleed, 84%)',
                  margin:      '0 auto',
                  cursor:      isActive ? 'default' : 'pointer',
                  opacity,
                  zIndex,
                  transform:   `translateX(calc(${tx * 100}% / 100 + ${dragOffset}px)) scale(${scale})`,
                  transition,
                  pointerEvents: noPtr ? 'none' : 'auto',
                  '--bleed':   '84%',
                } as React.CSSProperties}
              >
                {/* Wrap inactive slides so inner elements can't steal pointer events */}
                {isActive
                  ? renderSlide(i, true)
                  : (
                    <div style={{ pointerEvents: 'none', width: '100%' }}>
                      {renderSlide(i, false)}
                    </div>
                  )
                }
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Dot indicators ── */}
      {dots && count > 1 && (
        <div
          role="tablist"
          aria-label="Slides"
          style={{
            display:        'flex',
            justifyContent: 'center',
            gap:            6,
            marginTop:      16,
          }}
        >
          {Array.from({ length: count }, (_, i) => {
            const isActive = i === active
            return (
              <button
                key={i}
                role="tab"
                aria-selected={isActive}
                aria-label={dotLabel ? dotLabel(i) : slideLabel(i)}
                onClick={() => go(i)}
                style={{
                  height:           6,
                  width:            isActive ? 24 : 6,
                  borderRadius:     9999,
                  border:           'none',
                  padding:          0,
                  cursor:           'pointer',
                  background:       isActive ? 'var(--color-accent)' : 'var(--color-border)',
                  transition:       reducedMotion ? 'none' : 'width 200ms ease-out, background 200ms',
                  flexShrink:       0,
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-locked)'
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-border)'
                }}
              />
            )
          })}
        </div>
      )}

      {/* ── Visually hidden live region ── */}
      <div
        ref={liveRef}
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width:    1,
          height:   1,
          padding:  0,
          margin:   -1,
          overflow: 'hidden',
          clip:     'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border:   0,
        }}
      />
    </div>
  )
}
