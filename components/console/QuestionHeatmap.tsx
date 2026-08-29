/**
 * components/console/QuestionHeatmap.tsx
 * Supervisor-only view: shows questions asked by the supervisor's direct
 * reports as a horizontal bar chart.  A toggle switches between plotting
 * by platform (source_topic) and by problem area (category).
 *
 * Selecting a bar expands an inline panel immediately beneath it:
 *   Level 1 — the opposite dimension within the selected bar, ranked by count.
 *   Level 2 — the raw questions for that bar + selected item, paged via QuestionPanel.
 * Escape collapses the panel. Back (level 2 only) returns to level 1.
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserQuestion } from '@/lib/database.types'

const PAGE_SIZE     = 5
const MAX_BARS      = 15   // cap before folding remainder into "Other"
const MIN_COL_WIDTH = 160  // must match minmax() in the grid template

// Which dimension the chart is currently plotting
type Dim = 'platforms' | 'categories'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** slug → readable label: "my_tool" → "My Tool" */
function slugToLabel(slug: string): string {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// A single bar on the chart, or a row in the dialog's first level.
interface ChartBar { key: string; label: string; count: number }

// A drill-down item carrying its own question slice.
interface DrillItem extends ChartBar { questions: UserQuestion[] }

/** Build platform bars + per-slug question map from raw rows. */
function buildPlatformData(rows: UserQuestion[]): {
  bars:      ChartBar[]
  questions: Map<string, UserQuestion[]>
} {
  const countMap = new Map<string, number>()
  const qMap     = new Map<string, UserQuestion[]>()
  for (const row of rows) {
    if (!row.source_topic) continue
    const s = row.source_topic
    countMap.set(s, (countMap.get(s) ?? 0) + 1)
    if (!qMap.has(s)) qMap.set(s, [])
    qMap.get(s)!.push(row)
  }
  return buildBars(countMap, qMap, s => slugToLabel(s))
}

/** Build category bars + per-category question map from raw rows. */
function buildCategoryData(rows: UserQuestion[]): {
  bars:      ChartBar[]
  questions: Map<string, UserQuestion[]>
} {
  const countMap  = new Map<string, number>()
  const qMap      = new Map<string, UserQuestion[]>()
  const labelMap  = new Map<string, string>()   // key → category_label
  for (const row of rows) {
    const k = row.category
    countMap.set(k, (countMap.get(k) ?? 0) + 1)
    if (!qMap.has(k)) qMap.set(k, [])
    qMap.get(k)!.push(row)
    labelMap.set(k, row.category_label)
  }
  return buildBars(countMap, qMap, k => labelMap.get(k) ?? slugToLabel(k))
}

/** Shared tail: sort, cap at MAX_BARS, fold remainder into "Other". */
function buildBars(
  countMap: Map<string, number>,
  qMap:     Map<string, UserQuestion[]>,
  toLabel:  (k: string) => string,
): { bars: ChartBar[]; questions: Map<string, UserQuestion[]> } {
  if (countMap.size === 0) return { bars: [], questions: qMap }
  const sorted: ChartBar[] = Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, label: toLabel(key), count }))
  if (sorted.length <= MAX_BARS) return { bars: sorted, questions: qMap }
  const top       = sorted.slice(0, MAX_BARS)
  const overCount = sorted.slice(MAX_BARS).reduce((s, b) => s + b.count, 0)
  return {
    bars:      [...top, { key: '__other__', label: 'Other', count: overCount }],
    questions: qMap,
  }
}

/** Group a slice of questions by platform, sorted by count. */
function drillByPlatform(rows: UserQuestion[]): DrillItem[] {
  const map = new Map<string, DrillItem>()
  for (const row of rows) {
    if (!row.source_topic) continue
    const k = row.source_topic
    if (!map.has(k)) map.set(k, { key: k, label: slugToLabel(k), count: 0, questions: [] })
    const b = map.get(k)!
    b.count++; b.questions.push(row)
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

/** Group a slice of questions by category, sorted by count. */
function drillByCategory(rows: UserQuestion[]): DrillItem[] {
  const map = new Map<string, DrillItem>()
  for (const row of rows) {
    const k = row.category
    if (!map.has(k)) map.set(k, { key: k, label: row.category_label, count: 0, questions: [] })
    const b = map.get(k)!
    b.count++; b.questions.push(row)
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

// ─── Tile colour ramp ─────────────────────────────────────────────────────────
// Sequential four-step ramp: darkest tile for the busiest item, fading to the
// neutral sunken colour for the quietest.  Restored from commit d71805ca.

function tileColor(count: number, max: number): { bg: string; text: string } {
  if (max === 0) return { bg: 'var(--color-sunk)', text: 'var(--color-ink-muted)' }
  const ratio = count / max
  if (ratio >= 0.75) return { bg: 'var(--color-accent)',      text: '#fff' }
  if (ratio >= 0.5)  return { bg: '#f97a60',                  text: '#fff' }
  if (ratio >= 0.25) return { bg: 'var(--color-accent-soft)', text: 'var(--color-accent)' }
  return { bg: 'var(--color-sunk)', text: 'var(--color-ink-muted)' }
}

// ─── Bar geometry constants ────────────────────────────────────────────────────
// Shared between the page chart and the dialog, so both look identical.
const LABEL_W    = 130
const BAR_HEIGHT = 12
const ROW_HEIGHT = 40
const RADIUS     = 3
const COUNT_GAP  = 10

// ─── QuestionPanel ────────────────────────────────────────────────────────────

interface QuestionPanelProps {
  id?:        string
  label:      string
  subLabel?:  string
  questions:  UserQuestion[]
  page:       number
  visible:    boolean
  /** When true, omit the card chrome (border, background, radius, margin)
   *  and the header row. Use inside DrillPanel where the surrounding panel
   *  already provides both. */
  bare?:      boolean
  onClose:    () => void
  onPrevPage: () => void
  onNextPage: () => void
}

function QuestionPanel({
  id, label, subLabel, questions, page, visible, bare, onClose, onPrevPage, onNextPage,
}: QuestionPanelProps) {
  const panelRef   = useRef<HTMLDivElement>(null)
  const totalPages = Math.ceil(questions.length / PAGE_SIZE)
  const pageQs     = questions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div
      ref={panelRef}
      id={id}
      style={{
        ...(bare ? {} : {
          marginTop:    16,
          marginBottom: 16,
          background:   'var(--color-surface)',
          border:       '1px solid var(--color-border)',
          borderRadius: 12,
          overflow:     'hidden',
        }),
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 240ms ease, transform 240ms ease',
      }}
    >
      {/* header — omitted in bare mode */}
      {!bare && (
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>
            {label}
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
      )}

      {/* question rows */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {pageQs.map((q, i) => {
          const idx = page * PAGE_SIZE + i
          return (
            <li
              key={q.id}
              style={{
                padding:      '14px 20px',
                borderBottom: i < pageQs.length - 1 ? '1px solid var(--color-border)' : 'none',
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
                {idx + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink)', lineHeight: 1.5 }}>
                  {q.question}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-ink-muted)' }}>
                  {formatDate(q.asked_at)}
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
            type="button" disabled={page === 0} onClick={onPrevPage}
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
            type="button" disabled={page >= totalPages - 1} onClick={onNextPage}
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

// ─── DrillPanel ───────────────────────────────────────────────────────────────
// Inline panel that opens immediately below a selected chart bar.
// The tile grid for the opposite dimension is always visible; selecting a tile
// inserts the question list directly beneath the row of tiles containing it.

interface DrillPanelProps {
  id:         string           // stable id for aria-controls on the trigger button
  dim:        Dim              // what the chart is plotting
  barLabel:   string           // label of the selected chart bar
  questions:  UserQuestion[]   // all questions behind the selected bar
  onClose:    () => void
}

function DrillPanel({ id, dim, barLabel, questions, onClose }: DrillPanelProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [page,        setPage]        = useState(0)
  const [visible,     setVisible]     = useState(false)
  const [qVisible,    setQVisible]    = useState(false)

  const panelRef   = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLSpanElement>(null)
  const qPanelRef  = useRef<HTMLDivElement>(null)
  // Map from tile key → button element, for returning focus on collapse
  const tileRefs   = useRef<Map<string, HTMLButtonElement>>(new Map())

  // ── Animate panel in on mount ─────────────────────────────────────────────
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
  }, [])

  // Scroll panel into view once the entrance animation starts
  useEffect(() => {
    if (visible) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [visible])

  // Focus pill heading on mount
  useEffect(() => { headingRef.current?.focus() }, [])

  // ── Animate question list in when a tile is selected ─────────────────────
  useEffect(() => {
    if (selectedKey) {
      setQVisible(false)
      requestAnimationFrame(() => requestAnimationFrame(() => setQVisible(true)))
    } else {
      setQVisible(false)
    }
  }, [selectedKey])

  // Scroll the question list into view when it opens
  useEffect(() => {
    if (qVisible) qPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [qVisible])

  // ── Escape: first press collapses open list, second closes the panel ──────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (selectedKey) {
        const btn = tileRefs.current.get(selectedKey)
        setSelectedKey(null)
        requestAnimationFrame(() => btn?.focus())
      } else {
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selectedKey, onClose])

  // ── Derive tile items ─────────────────────────────────────────────────────
  const drillItems: DrillItem[] = dim === 'platforms'
    ? drillByCategory(questions)
    : drillByPlatform(questions)
  const maxDrillCount = drillItems[0]?.count ?? 0
  const selectedItem  = selectedKey ? drillItems.find(d => d.key === selectedKey) ?? null : null

  const drillDimLabel = dim === 'platforms' ? 'problem area' : 'platform'
  const listAriaLabel = dim === 'platforms'
    ? `Problem areas within ${barLabel}`
    : `Platforms within ${barLabel}`
  const qPanelId = selectedKey ? `${id}-qp-${selectedKey}` : undefined

  return (
    <div
      ref={panelRef}
      id={id}
      tabIndex={-1}
      style={{
        marginTop:    8,
        marginBottom: 8,
        background:   'var(--color-surface)',
        border:       '1px solid var(--color-border)',
        borderRadius: 12,
        overflow:     'hidden',
        opacity:      visible ? 1 : 0,
        transform:    visible ? 'translateY(0)' : 'translateY(10px)',
        transition:   'opacity 240ms ease, transform 240ms ease',
        outline:      'none',
      }}
    >
      {/* ── Panel header: pill + counts + close ─────────────────────────── */}
      <div style={{
        padding: '12px 16px 12px 20px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span
          ref={headingRef}
          tabIndex={-1}
          style={{
            flexShrink: 0,
            background: 'var(--color-accent)', color: '#fff',
            borderRadius: 6, padding: '2px 8px',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
        >
          {barLabel}
        </span>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--color-ink-muted)', fontFamily: 'var(--font-sans)' }}>
          {questions.length} question{questions.length === 1 ? '' : 's'}
          {' · '}
          {drillItems.length} {drillDimLabel}{drillItems.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse panel"
          style={{
            flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, lineHeight: 1, color: 'var(--color-ink-muted)',
            padding: '0 4px', fontFamily: 'var(--font-sans)',
          }}
        >×</button>
      </div>
      <div style={{ height: 1, background: 'var(--color-border)', margin: '0 20px' }} />

      {/* ── Panel body: tile grid, then question list beneath ────────────── */}
      {drillItems.length === 0 ? (
        <p style={{ margin: '16px 20px', fontSize: 13, color: 'var(--color-ink-muted)' }}>
          No {drillDimLabel} data available.
        </p>
      ) : (
        <div style={{ padding: '14px 20px 4px' }}>
          {/* Tile grid — wraps naturally, no row-splitting needed */}
          <div
            role="list"
            aria-label={listAriaLabel}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(${MIN_COL_WIDTH}px, 1fr))`,
              gap: 10,
              marginBottom: 10,
            }}
          >
            {drillItems.map(item => {
              const isOpen       = selectedKey === item.key
              const { bg, text } = tileColor(item.count, maxDrillCount)
              return (
                <div key={item.key} role="listitem">
                  <button
                    ref={el => {
                      if (el) tileRefs.current.set(item.key, el)
                      else    tileRefs.current.delete(item.key)
                    }}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={isOpen ? qPanelId : undefined}
                    onClick={() => {
                      if (isOpen) {
                        setSelectedKey(null)
                      } else {
                        setSelectedKey(item.key)
                        setPage(0)
                      }
                    }}
                    title={`${item.label}: ${item.count}`}
                    style={{
                      display:      'block',
                      width:        '100%',
                      background:   bg,
                      border:       isOpen ? '2px solid var(--color-accent)' : '2px solid transparent',
                      borderRadius: 12,
                      padding:      '16px 14px',
                      textAlign:    'left',
                      cursor:       'pointer',
                      fontFamily:   'var(--font-sans)',
                      transition:   'opacity 150ms',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                  >
                    <div style={{ fontSize: 26, fontWeight: 700, color: text, lineHeight: 1, marginBottom: 6 }}>
                      {item.count}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: text, lineHeight: 1.3 }}>
                      {item.label}
                    </div>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Question list — always after the full tile grid */}
          {selectedItem && (
            <div ref={qPanelRef}>
              <QuestionPanel
                id={qPanelId}
                label={selectedItem.label}
                questions={selectedItem.questions}
                page={page}
                visible={qVisible}
                onClose={() => {
                  const btn = tileRefs.current.get(selectedItem.key)
                  setSelectedKey(null)
                  requestAnimationFrame(() => btn?.focus())
                }}
                onPrevPage={() => setPage(p => p - 1)}
                onNextPage={() => setPage(p => p + 1)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── DimToggle ────────────────────────────────────────────────────────────────

interface DimToggleProps {
  dim:    Dim
  onSet:  (d: Dim) => void
}

function DimToggle({ dim, onSet }: DimToggleProps) {
  const opts: { value: Dim; label: string }[] = [
    { value: 'platforms',  label: 'Platforms'     },
    { value: 'categories', label: 'Problem areas' },
  ]
  return (
    <div
      role="group"
      aria-label="Chart dimension"
      style={{
        display: 'flex', gap: 2,
        background: 'var(--color-sunk)',
        border: '1px solid var(--color-border)',
        borderRadius: 8, padding: 2,
      }}
    >
      {opts.map(({ value, label }) => {
        const active = dim === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onSet(value)}
            style={{
              background:   active ? 'var(--color-surface)' : 'none',
              border:       active ? '1px solid var(--color-border)' : '1px solid transparent',
              borderRadius: 6,
              padding:      '4px 10px',
              fontSize:     11,
              fontWeight:   active ? 600 : 400,
              color:        active ? 'var(--color-ink)' : 'var(--color-ink-muted)',
              cursor:       active ? 'default' : 'pointer',
              fontFamily:   'var(--font-sans)',
              transition:   'background 120ms, color 120ms',
              whiteSpace:   'nowrap',
            }}
          >
            {label}
          </button>
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
  const [platformBars,        setPlatformBars]        = useState<ChartBar[]>([])
  const [categoryBars,        setCategoryBars]        = useState<ChartBar[]>([])
  const [platformQuestions,   setPlatformQuestions]   = useState<Map<string, UserQuestion[]>>(new Map())
  const [categoryQuestions,   setCategoryQuestions]   = useState<Map<string, UserQuestion[]>>(new Map())
  const [loading,             setLoading]             = useState(true)
  const [error,               setError]               = useState<string | null>(null)
  const [total,               setTotal]               = useState(0)
  const [dim,                 setDim]                 = useState<Dim>('platforms')

  const [openKey,   setOpenKey]   = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  // ── data fetch ──────────────────────────────────────────────────────────────
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
        const rows = (data ?? []).map(({ profiles: _p, ...rest }) => rest) as UserQuestion[]
        const pd = buildPlatformData(rows)
        const cd = buildCategoryData(rows)
        setTotal(rows.length)
        setPlatformBars(pd.bars)
        setCategoryBars(cd.bars)
        setPlatformQuestions(pd.questions)
        setCategoryQuestions(cd.questions)
        setLoading(false)
      })
  }, [orgId, supervisorId])

  // Switching dimension closes any open dialog
  const handleSetDim = (d: Dim) => {
    setOpenKey(null)
    setDim(d)
  }

  // ── early returns ───────────────────────────────────────────────────────────
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

  // ── derive chart data from active dimension ─────────────────────────────────
  const chartBars  = dim === 'platforms' ? platformBars  : categoryBars
  const qMapActive = dim === 'platforms' ? platformQuestions : categoryQuestions
  const dimCount   = chartBars.filter(b => b.key !== '__other__').length
  const maxCount   = chartBars[0]?.count ?? 0

  // Heading copy
  const dimNoun    = dim === 'platforms' ? 'platform'     : 'problem area'
  const dimNounPl  = dim === 'platforms' ? 'platforms'    : 'problem areas'
  const otherNoun  = dim === 'platforms' ? 'problem area' : 'platform'

  return (
    <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--color-page)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 24px' }}>

        {/* ── Heading row: section-label left, toggle right ────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <span className="section-label">Question heatmap</span>
          {total > 0 && (
            <DimToggle dim={dim} onSet={handleSetDim} />
          )}
        </div>

        {/* ── h1 + subtext ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>
            {total === 0
              ? 'No questions yet'
              : `${total} question${total === 1 ? '' : 's'} across ${dimCount} ${dimCount === 1 ? dimNoun : dimNounPl}`}
          </h1>
          {total > 0 && (
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-ink-muted)' }}>
              {`Bars ranked by volume. Select a ${dimNoun} to see which ${otherNoun === 'problem area' ? 'problem areas' : 'platforms'} it concerns.`}
            </p>
          )}
        </div>

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {total === 0 ? (
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 12, padding: '48px 24px', textAlign: 'center',
          }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-ink-muted)' }}>
              No questions have been asked yet. They will appear here as users interact with Compass.
            </p>
          </div>
        ) : chartBars.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-muted)' }}>
            No {dimNounPl} data available.
          </p>
        ) : (
          /* ── Bar chart ──────────────────────────────────────────────────── */
          <div
            role="list"
            aria-label={`${dim === 'platforms' ? 'Platform' : 'Problem area'} breakdown`}
            aria-live="polite"
            aria-atomic="true"
          >
            {chartBars.map(({ key, label, count }) => {
              const isOther     = key === '__other__'
              const isOpen      = openKey === key
              const pct         = maxCount > 0 ? (count / maxCount) * 100 : 0
              return (
                <div key={key} role="listitem">
                  <button
                    type="button"
                    disabled={isOther}
                    onClick={isOther ? undefined : e => {
                      triggerRef.current = e.currentTarget
                      setOpenKey(isOpen ? null : key)
                    }}
                    title={`${label}: ${count}`}
                    aria-expanded={isOther ? undefined : isOpen}
                    aria-controls={isOther ? undefined : `drill-panel-${key}`}
                    style={{
                      display: 'flex', alignItems: 'center',
                      width: '100%', height: ROW_HEIGHT,
                      padding: 0, background: 'none', border: 'none',
                      cursor: isOther ? 'default' : 'pointer',
                      fontFamily: 'var(--font-sans)', borderRadius: 6,
                    }}
                    onMouseEnter={e => {
                      if (!isOther)
                        (e.currentTarget as HTMLElement).style.background = 'var(--color-sunk)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'none'
                    }}
                  >
                    <div style={{
                      width: LABEL_W, flexShrink: 0, paddingRight: 14,
                      textAlign: 'right', fontSize: 13, fontWeight: 400,
                      color: 'var(--color-ink-muted)', whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-sans)',
                    }}>
                      {label}
                    </div>
                    <div style={{
                      flex: 1, position: 'relative', height: BAR_HEIGHT,
                      background: 'var(--color-sunk)', borderRadius: RADIUS,
                    }}>
                      <div style={{
                        position: 'absolute', left: 0, top: 0,
                        height: BAR_HEIGHT, width: `${pct}%`,
                        background: 'var(--color-accent)',
                        borderRadius: `0 ${RADIUS}px ${RADIUS}px 0`,
                        transition: 'width 300ms ease',
                      }} />
                    </div>
                    <div style={{
                      flexShrink: 0, paddingLeft: COUNT_GAP, fontSize: 12,
                      fontWeight: 500, color: 'var(--color-ink-muted)',
                      minWidth: 32, textAlign: 'left', fontFamily: 'var(--font-sans)',
                    }}>
                      {count}
                    </div>
                  </button>
                  {isOpen && (qMapActive.get(key) ?? []).length > 0 && (
                    <DrillPanel
                      id={`drill-panel-${key}`}
                      dim={dim}
                      barLabel={label}
                      questions={qMapActive.get(key)!}
                      onClose={() => setOpenKey(null)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
