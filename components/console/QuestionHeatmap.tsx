/**
 * components/console/QuestionHeatmap.tsx
 * Supervisor-only view: shows all questions asked by users in the org,
 * grouped by AI-assigned category as a heat-grid.
 *
 * Layout:
 *   Top: category tiles ranked by question count (colour intensity = count).
 *   Below: expandable list of raw questions per category.
 */
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserQuestion } from '@/lib/database.types'

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
      map.set(key, {
        category:       key,
        category_label: row.category_label,
        count:          0,
        questions:      [],
      })
    }
    const bucket = map.get(key)!
    bucket.count++
    bucket.questions.push(row)
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

// Colour ramp: low count → pale, high count → accent
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
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  orgId: string
}

export default function QuestionHeatmap({ orgId }: Props) {
  const [buckets,    setBuckets]    = useState<CategoryBucket[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [total,      setTotal]      = useState(0)

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

  if (!orgId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>Organisation ID not available.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>Loading question data…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <p style={{ fontSize: 13, color: 'var(--color-accent)' }}>Could not load questions: {error}</p>
      </div>
    )
  }

  const max = buckets[0]?.count ?? 0

  return (
    <div
      className="thin-scroll"
      style={{ flex: 1, overflowY: 'auto', background: 'var(--color-page)' }}
    >
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
          <div
            style={{
              background: 'var(--color-surface)',
              border:     '1px solid var(--color-border)',
              borderRadius: 12,
              padding:    '48px 24px',
              textAlign:  'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-ink-muted)' }}>
              No questions have been asked yet. They will appear here as users interact with Compass.
            </p>
          </div>
        ) : (
          <>
            {/* Heat grid */}
            <div
              style={{
                display:             'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap:                 16,
                marginBottom:        36,
              }}
            >
              {buckets.map(b => {
                const { bg, text } = tileColor(b.count, max)
                const isOpen       = expanded === b.category
                return (
                  <button
                    key={b.category}
                    type="button"
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
                    <div style={{ marginTop: 6, fontSize: 11, color: text, opacity: 0.75, fontFamily: 'var(--font-sans)', letterSpacing: '0.02em' }}>
                      {b.category}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Expanded questions panel */}
            {expanded && (() => {
              const bucket = buckets.find(b => b.category === expanded)
              if (!bucket) return null
              return (
                <div
                  style={{
                    background:   'var(--color-surface)',
                    border:       '1px solid var(--color-border)',
                    borderRadius: 12,
                    overflow:     'hidden',
                  }}
                >
                  {/* Panel header */}
                  <div
                    style={{
                      padding:        '16px 20px',
                      borderBottom:   '1px solid var(--color-border)',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'space-between',
                      gap:            16,
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>
                        {bucket.category_label}
                      </span>
                      <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--color-ink-muted)' }}>
                        {bucket.count} question{bucket.count === 1 ? '' : 's'}
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
                    >
                      ×
                    </button>
                  </div>

                  {/* Question rows */}
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {bucket.questions.map((q, i) => (
                      <li
                        key={q.id}
                        style={{
                          padding:     '14px 20px',
                          borderBottom: i < bucket.questions.length - 1
                            ? '1px solid var(--color-border)'
                            : 'none',
                          display:     'flex',
                          alignItems:  'flex-start',
                          gap:         14,
                        }}
                      >
                        <span
                          style={{
                            flexShrink:  0,
                            marginTop:   2,
                            width:       24,
                            height:      24,
                            borderRadius: '50%',
                            background:  'var(--color-accent-soft)',
                            color:       'var(--color-accent)',
                            fontSize:    11,
                            fontWeight:  600,
                            display:     'flex',
                            alignItems:  'center',
                            justifyContent: 'center',
                            fontFamily:  'var(--font-sans)',
                          }}
                        >
                          {i + 1}
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
                    ))}
                  </ul>
                </div>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}
