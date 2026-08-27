/**
 * components/console/QuestionHeatmap.tsx
 * Supervisor-only view: shows all questions asked by users in the org,
 * grouped by AI-assigned category as a heat-grid.
 *
 * Layout:
 *   Category tiles ranked by question count (colour intensity = count).
 *   Clicking a tile opens a question panel inline — inserted after the row
 *   that contains the clicked card so subsequent rows push down naturally.
 */
'use client'

import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserQuestion } from '@/lib/database.types'

const PAGE_SIZE    = 5
const MIN_COL_WIDTH = 180  // must match minmax() in CSS grid

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

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { orgId: string }

export default function QuestionHeatmap({ orgId }: Props) {
  const [buckets,  setBuckets]  = useState<CategoryBucket[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(0)
  const [visible,  setVisible]  = useState(false)
  const [cols,     setCols]     = useState(4)   // live column count

  const gridRef  = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // ── measure columns from the grid container width ─────────────────────────
  const measureCols = useCallback(() => {
    if (!gridRef.current) return
    const w = gridRef.current.getBoundingClientRect().width
    // replicate auto-fill: minmax(MIN_COL_WIDTH, 1fr) with gap 16
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
  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    const supabase = createClient()
    supabase
      .from('user_questions')
      .select('*')
      .eq('org_id', orgId)
      .order('asked_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return }
        const rows = (data ?? []) as UserQuestion[]
        setTotal(rows.length)
        setBuckets(bucketQuestions(rows))
        setLoading(false)
      })
  }, [orgId])

  if (!orgId) return (
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

  const max = buckets[0]?.count ?? 0

  // which row index (0-based) contains the expanded card?
  const expandedRowIndex = expanded
    ? Math.floor(buckets.findIndex(b => b.category === expanded) / cols)
    : -1

  const rows = toRows(buckets, cols)

  // panel contents (computed once, used inside the row loop)
  const expandedBucket   = expanded ? buckets.find(b => b.category === expanded) ?? null : null
  const totalPages       = expandedBucket ? Math.ceil(expandedBucket.questions.length / PAGE_SIZE) : 0
  const pageQuestions    = expandedBucket
    ? expandedBucket.questions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : []

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
          /* Outer container — measured for column counting */
          <div ref={gridRef}>
            {rows.map((rowBuckets, rowIndex) => (
              <div key={rowIndex}>

                {/* ── tile row ─────────────────────────────────────────── */}
                <div style={{
                  display:             'grid',
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap:                 16,
                  marginBottom:        expandedRowIndex === rowIndex ? 0 : 16,
                }}>
                  {rowBuckets.map(b => {
                    const { bg, text } = tileColor(b.count, max)
                    const isOpen       = expanded === b.category
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
                  })}
                </div>

                {/* ── inline panel — only after the row with the active card ── */}
                {expandedRowIndex === rowIndex && expandedBucket && (
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
                          {expandedBucket.category_label}
                        </span>
                        <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--color-ink-muted)' }}>
                          {expandedBucket.count} question{expandedBucket.count === 1 ? '' : 's'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpanded(null)}
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
                          onClick={() => setPage(p => p - 1)}
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
                          onClick={() => setPage(p => p + 1)}
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
                )}

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
