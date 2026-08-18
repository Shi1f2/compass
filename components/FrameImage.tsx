/**
 * components/FrameImage.tsx
 * A rendered SoftwareFrame with an optional machine-detected region box drawn
 * over it. Coordinates are normalised (0–1), so the same rectangle works at
 * thumbnail, console and print sizes with no recalculation.
 */

import { memo } from 'react'
import type { Highlight, Scene } from '@/lib/types'
import { SoftwareFrame } from '@/components/screens/SoftwareFrame'

// ─── Plain frame (memoised) ───────────────────────────────────────────────────

/**
 * Renders the software frame for a given scene.
 * Memoised because scene and highlight objects keep their identity across
 * edits, so typing in the console does not re-render every frame on screen.
 */
export const SceneFrame = memo(function SceneFrame({ scene }: { scene: Scene }) {
  return <SoftwareFrame scene={scene} />
})

// ─── Detection box ────────────────────────────────────────────────────────────

interface FrameImageProps {
  scene: Scene
  highlight?: Highlight
  /** Whether the detection box is visible. Defaults to true. */
  showHighlight?: boolean
  /**
   * Darkens everything outside the detected region using a large inset shadow.
   * This is not decoration — it is a scrim mixed from the ink colour so the
   * tint matches the app's own text, rather than a fixed translucent black.
   * Used in the console view only.
   */
  dim?: boolean
  /** Show the text label pill above/below the box. Defaults to false. */
  label?: boolean
  /** Apply the pulsing halo animation to the box. Defaults to false. */
  pulse?: boolean
  /**
   * Compact mode: thinner (1px) border, no corner tick dots. Used for
   * thumbnail-sized frames where the ticks would read as noise.
   */
  compact?: boolean
  /** Class name for the outer container — callers use this to set size. */
  className?: string
}

export default memo(function FrameImage({
  scene,
  highlight,
  showHighlight = true,
  dim = false,
  label = false,
  pulse = false,
  compact = false,
  className,
}: FrameImageProps) {
  const hasBox = Boolean(highlight && showHighlight)

  // Convert normalised coords to percentage strings
  const pct = (n: number) => `${n * 100}%`

  return (
    <div
      className={[
        'relative overflow-hidden bg-surface',
        className ?? '',
      ].join(' ')}
    >
      {/* 8:5 aspect-ratio wrapper locking the frame to its natural proportions */}
      <div className="w-full" style={{ aspectRatio: '960 / 600' }}>
        <SceneFrame scene={scene} />

        {/* Detection box */}
        {hasBox && highlight && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top:    pct(highlight.y),
              left:   pct(highlight.x),
              width:  pct(highlight.width),
              height: pct(highlight.height),
              borderRadius: '8px',
              border: `${compact ? 1 : 2}px solid var(--color-accent)`,
              pointerEvents: 'none',
              boxSizing: 'border-box',
              ...(dim
                ? {
                    // The large spread scrim is mixed from the ink colour so the
                    // darkening tint matches the app's own text colour rather
                    // than a fixed translucent black.
                    boxShadow: `0 0 0 9999px color-mix(in srgb, var(--color-ink) 13%, transparent)${pulse ? `, 0 0 0 0 color-mix(in srgb, var(--color-accent) 28%, transparent)` : ''}`,
                  }
                : pulse
                ? { animation: 'halo 2.4s ease-out infinite' }
                : {}),
            }}
          >
            {/* Corner tick dots — omitted in compact mode */}
            {!compact && (
              <>
                {([
                  { top: '-3px',    left: '-3px'  },
                  { top: '-3px',    right: '-3px' },
                  { bottom: '-3px', left: '-3px'  },
                  { bottom: '-3px', right: '-3px' },
                ] as React.CSSProperties[]).map((pos, i) => (
                  <span
                    key={i}
                    style={{
                      position: 'absolute',
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: 'var(--color-accent)',
                      ...pos,
                    }}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* Label pill */}
        {label && highlight?.label && showHighlight && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left:       pct(highlight.x + highlight.width / 2),
              transform: 'translateX(-50%)',
              // If the highlight is near the top, place the label below it;
              // otherwise place it above.
              ...(highlight.y > 0.07
                ? { bottom: `calc(${pct(1 - highlight.y)} + 6px)` }
                : { top:    `calc(${pct(highlight.y + highlight.height)} + 6px)` }),
              pointerEvents: 'none',
              background: 'var(--color-accent)',
              color: '#ffffff',
              borderRadius: '9999px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              lineHeight: '18px',
            }}
          >
            {highlight.label}
          </div>
        )}
      </div>
    </div>
  )
})
