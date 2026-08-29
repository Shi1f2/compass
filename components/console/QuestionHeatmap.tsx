/**
 * components/console/QuestionHeatmap.tsx
 * Supervisor-only view: shows questions asked by the supervisor's direct
 * reports, grouped by AI-assigned category as a heat-grid.
 *
 * Layout:
 *   Category tiles ranked by question count (colour intensity = count),
 *   followed by a single platform tile (top platform by volume) at the end.
 *   Clicking a tile opens a question panel inline — inserted after the row
 *   that contains the clicked card so subsequent rows push down naturally.
 *   Below the tile grid: a horizontal bar chart of all platforms by volume.
 */
'use client'

import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserQuestion } from '@/lib/database.types'

const PAGE_SIZE     = 5
const MIN_COL_WIDTH = 180  // must match minmax() in CSS grid

// Sentinel key for the platform tile — guaranteed not to collide with a category key.
const PLATFORM_KEY = '__platform__'

// Maximum distinct bars before the remainder is folded into "Other".
const MAX_PLATFORM_BARS = 11

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryBucket {
  category:       string
  category_label: string
  count:          number
  questions:      UserQuestion[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bucketQuestions(rows: UserQuestion[]): CategoryBucket[] {
  const map = new Map<string, CategoryBucket>()
  for (const row of rows) {
    const key = row.category
    if (!map.has(key)) {
      map.set(key, { category: key, category_label: row.category_label, count: 0, questions: [] })
    }
    const bucket = map.get(key)!
    bucket.count++
    bucket.questions.push(row)
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

/** Derive a human-readable label from a slug: replace separators with spaces,
 *  capitalise each word.  e.g. "product-updates_v2" → "Product Updates V2" */
function slugToLabel(slug: string): string {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/** Aggregate all platforms into a sorted bar list, folding overflow into "Other". */
function platformBarsFromRows(rows: UserQuestion[]): Array<{ slug: string; label: string; count: number }> {
  const map = new Map<string, number>()
  for (const row of rows) {
    if (!row.source_topic) continue
    map.set(row.source_topic, (map.get(row.source_topic) ?? 0) + 1)
  }
  if (map.size === 0) return []

  const sorted = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([slug, count]) => ({ slug, label: slugToLabel(slug), count }))

  if (sorted.length <= MAX_PLATFORM_BARS) return sorted

  const top   = sorted.slice(0, MAX_PLATFORM_BARS)
  const other = sorted.slice(MAX_PLATFORM_BARS).reduce((sum, b) => sum + b.count, 0)
  return [...top, { slug: '__other__', label: 'Other', count: other }]
}

/** Return the platform (source_topic slug) with the most questions, or null. */
function topPlatform(rows: UserQuestion[]): { slug: string; count: number; questions: UserQuestion[] } | null {
  const map = new Map<string, { count: number; questions: UserQuestion[] }>()
  for (const row of rows) {
    if (!row.source_topic) continue
    const slug = row.source_topic
    if (!map.has(slug)) map.set(slug, { count: 0, questions: [] })
    const entry = map.get(slug)!
    entry.count++
    entry.questions.push(row)
  }
  if (map.size === 0) return null
  const [slug, { count, questions }] = Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count)[0]
  return { slug, count, questions }
}

function tileColor(count: number, max: number): { bg: string; text: string } {
  if (max === 0) return { bg: 'var(--color-sunk)', text: 'var(--color-ink-muted)' }
  const ratio = count / max
  if (ratio >= 0.75) return { bg: 'var(--color-accent)',      text: '#fff' }
  if (ratio >= 0.5)  return { bg: '#f97a60',                  text: '#fff' }
  if (ratio >= 0.25) return { bg: 'var(--color-accent-soft)', text: 'var(--color-accent)' }
  return { bg: 'var(--color-sunk)', text: 'var(--color-ink-muted)' }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** Split a flat array into rows of `cols` each. */
function toRows<T>(items: T[], cols: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols))
  return rows
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface QuestionPanelProps {
  label:      string
  subLabel:   string   // the key/slug shown beneath the label
  questions:  UserQuestion[]
  page:       number
  visible:    boolean
  onClose:    () => void
  onPrevPage: () => void
  onNextPage: () => void
}

function QuestionPanel({
  label, subLabel, questions, page, visible, onClose, onPrevPage, onNextPage,
}: QuestionPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const totalPages    = Math.ceil(questions.length / PAGE_SIZE)
  const pageQuestions = questions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div
      ref={panelRef}
      style={{
        marginTop:    16,
        marginBottom: 16,
        background:   'var(--color-surface)',
        border:       '1px solid var(--color-border)',
        borderRadius: 12,
        overflow:     'hidden',
        opacity:      visible ? 1 : 0,
        transform:    visible ? 'translateY(0)' : 'translateY(10px)',
        transition:   'opacity 240ms ease, transform 240ms ease',
      }}
    >
      {/* panel header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>
            {label}
          </span>
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-ink-muted)', letterSpacing: '0.02em' }}>
            {subLabel}
          </span>
          <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--color-ink-muted)' }}>
            {questions.length} question{questions.length === 1 ? '' : 's'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, lineHeight: 1, color: 'var(--color-ink-muted)',
            padding: '0 4px', fontFamily: 'var(--font-sans)',
          }}
        >×</button>
      </div>

      {/* question rows — current page only */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {pageQuestions.map((q, i) => {
          const globalIndex = page * PAGE_SIZE + i
          return (
            <li
              key={q.id}
              style={{
                padding:      '14px 20px',
                borderBottom: i < pageQuestions.length - 1 ? '1px solid var(--color-border)' : 'none',
                display:      'flex',
                alignItems:   'flex-start',
                gap:          14,
              }}
            >
              <span style={{
                flexShrink: 0, marginTop: 2, width: 24, height: 24,
                borderRadius: '50%', background: 'var(--color-accent-soft)',
                color: 'var(--color-accent)', fontSize: 11, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-sans)',
              }}>
                {globalIndex + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink)', lineHeight: 1.5 }}>
                  {q.question}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-ink-muted)' }}>
                  {formatDate(q.asked_at)}
                  {q.source_topic && (
                    <> &middot; topic: <code style={{ fontSize: 11 }}>{q.source_topic}</code></>
                  )}
                </p>
              </div>
            </li>
          )
        })}
      </ul>

      {/* pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', borderTop: '1px solid var(--color-border)',
          background: 'var(--color-sunk)',
        }}>
          <button
            type="button"
            disabled={page === 0}
            onClick={onPrevPage}
            style={{
              background: page === 0 ? 'none' : 'var(--color-surface)',
              border: '1px solid var(--color-border)', borderRadius: 8,
              padding: '6px 14px', fontSize: 13, fontFamily: 'var(--font-sans)',
              cursor: page === 0 ? 'default' : 'pointer',
              color: page === 0 ? 'var(--color-ink-muted)' : 'var(--color-ink)',
              opacity: page === 0 ? 0.45 : 1, transition: 'opacity 150ms',
            }}
          >← Previous</button>

          <span style={{ fontSize: 12, color: 'var(--color-ink-muted)', fontFamily: 'var(--font-sans)' }}>
            Page {page + 1} of {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={onNextPage}
            style={{
              background: page >= totalPages - 1 ? 'none' : 'var(--color-surface)',
              border: '1px solid var(--color-border)', borderRadius: 8,
              padding: '6px 14px', fontSize: 13, fontFamily: 'var(--font-sans)',
              cursor: page >= totalPages - 1 ? 'default' : 'pointer',
              color: page >= totalPages - 1 ? 'var(--color-ink-muted)' : 'var(--color-ink)',
              opacity: page >= totalPages - 1 ? 0.45 : 1, transition: 'opacity 150ms',
            }}
          >Next →</button>
        </div>
      )}
    </div>
  )
}

// ─── Platform bar chart ───────────────────────────────────────────────────────

interface PlatformBarChartProps {
  bars: Array<{ slug: string; label: string; count: number }>
}

function PlatformBarChart({ bars }: PlatformBarChartProps) {
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)

  if (bars.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-muted)' }}>
        No platform data available.
      </p>
    )
  }

  const maxCount    = bars[0].count
  // Fixed width for the label column; bars fill the remaining space.
  const LABEL_W     = 120
  const BAR_HEIGHT  = 10
  const ROW_HEIGHT  = 32   // vertical rhythm per bar row
  const RADIUS      = 3    // corner radius on the data end of each bar
  const COUNT_GAP   = 8    // gap between bar end and count label

  return (
    <div role="img" aria-label="Platform breakdown bar chart">
      {bars.map(({ slug, label, count }) => {
        const isHovered = hoveredSlug === slug
        const tooltip   = isHovered ? `${label}: ${count}` : undefined
        return (
          <div
            key={slug}
            onMouseEnter={() => setHoveredSlug(slug)}
            onMouseLeave={() => setHoveredSlug(null)}
            title={tooltip}
            style={{
              display:    'flex',
              alignItems: 'center',
              height:     ROW_HEIGHT,
              cursor:     'default',
              position:   'relative',
            }}
          >
            {/* Label column — fixed width, right-aligned */}
            <div style={{
              width:      LABEL_W,
              flexShrink: 0,
              paddingRight: 12,
              textAlign:  'right',
              fontSize:   12,
              fontWeight: isHovered ? 600 : 400,
              color:      isHovered ? 'var(--color-ink)' : 'var(--color-ink-muted)',
              whiteSpace: 'nowrap',
              overflow:   'hidden',
              textOverflow: 'ellipsis',
              transition: 'color 120ms, font-weight 120ms',
              fontFamily: 'var(--font-sans)',
            }}>
              {label}
            </div>

            {/* Bar track + bar */}
            <div style={{ flex: 1, position: 'relative', height: BAR_HEIGHT, background: 'var(--color-sunk)', borderRadius: RADIUS }}>
              <div style={{
                position:     'absolute',
                left:         0,
                top:          0,
                height:       BAR_HEIGHT,
                width:        `${(count / maxCount) * 100}%`,
                background:   'var(--color-accent)',
                // Right end rounded, left end square (grows from shared origin)
                borderRadius: `0 ${RADIUS}px ${RADIUS}px 0`,
                transition:   'width 300ms ease',
              }} />
            </div>

            {/* Count label */}
            <div style={{
              flexShrink: 0,
              paddingLeft: COUNT_GAP,
              fontSize:   12,
              fontWeight: 500,
              color:      isHovered ? 'var(--color-ink)' : 'var(--color-ink-muted)',
              fontFamily: 'var(--font-sans)',
              minWidth:   28,
              transition: 'color 120ms',
            }}>
              {count}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  orgId:        string
  supervisorId: string
}

export default function QuestionHeatmap({ orgId, supervisorId }: Props) {
  const [buckets,      setBuckets]      = useState<CategoryBucket[]>([])
  const [platform,     setPlatform]     = useState<{ slug: string; count: number; questions: UserQuestion[] } | null>(null)
  const [platformBars, setPlatformBars] = useState<Array<{ slug: string; label: string; count: number }>>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(0)
  const [visible,      setVisible]      = useState(false)
  const [cols,         setCols]         = useState(4)

  const gridRef = useRef<HTMLDivElement>(null)

  // ── measure columns from the grid container width ─────────────────────────
  const measureCols = useCallback(() => {
    if (!gridRef.current) return
    const w = gridRef.current.getBoundingClientRect().width
    const gap = 16
    const n = Math.max(1, Math.floor((w + gap) / (MIN_COL_WIDTH + gap)))
    setCols(n)
  }, [])

  useLayoutEffect(() => {
    measureCols()
    const ro = new ResizeObserver(measureCols)
    if (gridRef.current) ro.observe(gridRef.current)
    return () => ro.disconnect()
  }, [measureCols])

  // ── animate panel in whenever expanded changes ─────────────────────────────
  useEffect(() => {
    if (expanded) {
      setPage(0)
      setVisible(false)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
    }
  }, [expanded])

  // ── data fetch ────────────────────────────────────────────────────────────
  // Filter to direct reports in a single round trip by joining through the
  // profiles FK with !inner — PostgREST discards rows where the join finds
  // no match, so only questions whose asker has supervisor_id = supervisorId
  // are returned.  The nested profiles object is stripped before bucketing.
  useEffect(() => {
    if (!orgId || !supervisorId) { setLoading(false); return }
    const supabase = createClient()
    supabase
      .from('user_questions')
      .select('*, profiles!user_questions_user_id_fkey!inner(supervisor_id)')
      .eq('org_id', orgId)
      .eq('profiles.supervisor_id', supervisorId)
      .order('asked_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return }
        // Strip the nested profiles object — UserQuestion doesn't include it.
        const rows = (data ?? []).map(({ profiles: _p, ...rest }) => rest) as UserQuestion[]
        setTotal(rows.length)
        setBuckets(bucketQuestions(rows))
        setPlatform(topPlatform(rows))
        setPlatformBars(platformBarsFromRows(rows))
        setLoading(false)
      })
  }, [orgId, supervisorId])

  if (!orgId || !supervisorId) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>Organisation ID not available.</p>
    </div>
  )

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>Loading question data…</p>
    </div>
  )

  if (error) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <p style={{ fontSize: 13, color: 'var(--color-accent)' }}>Could not load questions: {error}</p>
    </div>
  )

  // ── build tile list: category tiles sorted by count, platform tile last ────
  //
  // The platform tile uses PLATFORM_KEY so it can never accidentally match a
  // category key. When there is no platform data yet the tile renders in an
  // empty/muted state and is not interactive.

  const max = buckets[0]?.count ?? 0

  // which row index (0-based) contains the expanded card?
  const allKeys          = [...buckets.map(b => b.category), PLATFORM_KEY]
  const expandedIndex    = expanded ? allKeys.indexOf(expanded) : -1
  const expandedRowIndex = expandedIndex >= 0 ? Math.floor(expandedIndex / cols) : -1

  // Build rows over category tiles only first, then we append the platform
  // tile after. We need the flat list to compute row placement.
  const categoryCount = buckets.length
  const totalTiles    = categoryCount + 1   // + 1 for the platform tile
  const allTileRows   = toRows(Array.from({ length: totalTiles }, (_, i) => i), cols)

  // resolved panel data for the expanded tile (used once below)
  const expandedBucket    = expanded && expanded !== PLATFORM_KEY
    ? buckets.find(b => b.category === expanded) ?? null
    : null
  const expandedPlatPanel = expanded === PLATFORM_KEY && platform ? platform : null

  return (
    <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--color-page)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <span className="section-label" style={{ display: 'block', marginBottom: 6 }}>
            Question heatmap
          </span>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>
            {total === 0
              ? 'No questions yet'
              : `${total} question${total === 1 ? '' : 's'} across ${buckets.length} categor${buckets.length === 1 ? 'y' : 'ies'}`}
          </h1>
          {total > 0 && (
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-ink-muted)' }}>
              Tiles ranked by volume. Darker colour = more questions. Click a tile to see the raw questions.
            </p>
          )}
        </div>

        {total === 0 ? (
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 12, padding: '48px 24px', textAlign: 'center',
          }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-ink-muted)' }}>
              No questions have been asked yet. They will appear here as users interact with Compass.
            </p>
          </div>
        ) : (
          <>
          {/* Outer container — measured for column counting */}
          <div ref={gridRef}>
            {allTileRows.map((tileIndices, rowIndex) => (
              <div key={rowIndex}>

                {/* ── tile row ─────────────────────────────────────────── */}
                <div style={{
                  display:             'grid',
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap:                 16,
                  marginBottom:        expandedRowIndex === rowIndex ? 0 : 16,
                }}>
                  {tileIndices.map(tileIndex => {
                    // ── category tiles ─────────────────────────────────
                    if (tileIndex < categoryCount) {
                      const b = buckets[tileIndex]
                      const { bg, text } = tileColor(b.count, max)
                      const isOpen = expanded === b.category
                      return (
                        <button
                          key={b.category}
                          type="button"
                          aria-pressed={isOpen}
                          onClick={() => setExpanded(isOpen ? null : b.category)}
                          style={{
                            background:   bg,
                            border:       isOpen ? '2px solid var(--color-accent)' : '2px solid transparent',
                            borderRadius: 12,
                            padding:      '20px 18px',
                            textAlign:    'left',
                            cursor:       'pointer',
                            fontFamily:   'var(--font-sans)',
                            transition:   'opacity 150ms',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'    }}
                        >
                          <div style={{ fontSize: 28, fontWeight: 700, color: text, lineHeight: 1, marginBottom: 8 }}>
                            {b.count}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: text, lineHeight: 1.3 }}>
                            {b.category_label}
                          </div>
                          <div style={{ marginTop: 6, fontSize: 11, color: text, opacity: 0.75, letterSpacing: '0.02em' }}>
                            {b.category}
                          </div>
                        </button>
                      )
                    }

                    // ── platform tile (always last) ─────────────────────
                    const { bg: emptyBg, text: emptyText } = tileColor(0, 0)
                    if (!platform) {
                      // empty state — visible but not interactive
                      return (
                        <div
                          key={PLATFORM_KEY}
                          style={{
                            background:   emptyBg,
                            border:       '2px solid transparent',
                            borderRadius: 12,
                            padding:      '20px 18px',
                            textAlign:    'left',
                            fontFamily:   'var(--font-sans)',
                          }}
                        >
                          <div style={{ fontSize: 28, fontWeight: 700, color: emptyText, lineHeight: 1, marginBottom: 8 }}>
                            —
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: emptyText, lineHeight: 1.3 }}>
                            &nbsp;
                          </div>
                          <div style={{ marginTop: 6, fontSize: 11, color: emptyText, opacity: 0.75, letterSpacing: '0.02em' }}>
                            top platform
                          </div>
                        </div>
                      )
                    }

                    // platform tile with data
                    const { bg, text } = tileColor(platform.count, max)
                    const isOpen = expanded === PLATFORM_KEY
                    return (
                      <button
                        key={PLATFORM_KEY}
                        type="button"
                        aria-pressed={isOpen}
                        onClick={() => setExpanded(isOpen ? null : PLATFORM_KEY)}
                        style={{
                          background:   bg,
                          border:       isOpen ? '2px solid var(--color-accent)' : '2px solid transparent',
                          borderRadius: 12,
                          padding:      '20px 18px',
                          textAlign:    'left',
                          cursor:       'pointer',
                          fontFamily:   'var(--font-sans)',
                          transition:   'opacity 150ms',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'    }}
                      >
                        <div style={{ fontSize: 28, fontWeight: 700, color: text, lineHeight: 1, marginBottom: 8 }}>
                          {platform.count}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: text, lineHeight: 1.3 }}>
                          {slugToLabel(platform.slug)}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 11, color: text, opacity: 0.75, letterSpacing: '0.02em' }}>
                          top platform
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* ── inline panel — only after the row with the active card ── */}
                {expandedRowIndex === rowIndex && (expandedBucket || expandedPlatPanel) && (
                  <QuestionPanel
                    label={
                      expandedBucket
                        ? expandedBucket.category_label
                        : slugToLabel(expandedPlatPanel!.slug)
                    }
                    subLabel={
                      expandedBucket
                        ? expandedBucket.category
                        : expandedPlatPanel!.slug
                    }
                    questions={
                      expandedBucket
                        ? expandedBucket.questions
                        : expandedPlatPanel!.questions
                    }
                    page={page}
                    visible={visible}
                    onClose={() => setExpanded(null)}
                    onPrevPage={() => setPage(p => p - 1)}
                    onNextPage={() => setPage(p => p + 1)}
                  />
                )}

              </div>
            ))}
          </div>

          {/* ── Platform bar chart ────────────────────────────────────────── */}
          <div style={{ marginTop: 36 }}>
            <span className="section-label" style={{ display: 'block', marginBottom: 16 }}>
              By platform
            </span>
            <PlatformBarChart bars={platformBars} />
          </div>
          </>
        )}
      </div>
    </div>
  )
}
