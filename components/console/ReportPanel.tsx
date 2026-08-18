/**
 * components/console/ReportPanel.tsx
 *
 * Side panel for configuring the export before printing.
 * Opens over the right edge of the screen, behind a scrim that closes it.
 * All state is held by the caller — this component is entirely controlled.
 */
'use client'

import { Eye, Download } from 'lucide-react'
import { TOPICS_PER_SHEET, QUESTIONS_PER_SHEET } from '@/components/pdf/PdfPreview'

// ─── Exported config type ─────────────────────────────────────────────────────

export type ExportConfig = {
  /** 'manager' = manager summary; 'compliance' = compliance evidence pack */
  kind:          'manager' | 'compliance'
  illustrations: boolean
  pageSize:      'A4' | 'Letter'
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReportPanelProps {
  config:       ExportConfig
  topicCount:   number
  questionCount: number
  onConfig:     (c: ExportConfig) => void
  onClose:      () => void
  onPreview:    () => void
  onPrint:      () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estimateSheets(config: ExportConfig, topicCount: number, questionCount: number): number {
  // Import per-sheet constants from the preview module so the estimate
  // can never disagree with what actually renders.
  const perSheet = config.kind === 'compliance' ? QUESTIONS_PER_SHEET : TOPICS_PER_SHEET
  const count    = config.kind === 'compliance' ? questionCount       : topicCount
  return Math.max(1, Math.ceil(count / perSheet))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin:        0,
        fontSize:      11,
        fontWeight:    500,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color:         'var(--color-ink-muted)',
        fontFamily:    'var(--font-sans)',
        marginBottom:  10,
      }}
    >
      {children}
    </p>
  )
}

// Radio row for output type selection
function KindRow({
  id, title, hint, checked, onSelect,
}: {
  id:       'manager' | 'compliance'
  title:    string
  hint:     string
  checked:  boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      style={{
        display:      'flex',
        alignItems:   'flex-start',
        gap:          14,
        width:        '100%',
        padding:      '16px 20px',
        borderRadius: 14,
        border:       checked ? 'none' : '1px solid var(--color-border)',
        background:   checked ? 'var(--color-accent-soft)' : 'var(--color-surface)',
        cursor:       'pointer',
        textAlign:    'left',
        fontFamily:   'var(--font-sans)',
        transition:   'background 150ms',
      }}
      onMouseEnter={e => {
        if (!checked) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-sunk)'
      }}
      onMouseLeave={e => {
        if (!checked) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)'
      }}
    >
      {/* Radio dot */}
      <span
        aria-hidden="true"
        style={{
          flexShrink:   0,
          width:        18,
          height:       18,
          borderRadius: '50%',
          border:       checked
            ? '2px solid var(--color-accent)'
            : '1.5px solid var(--color-border)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          marginTop:    1,
        }}
      >
        {checked && (
          <span
            style={{
              width:        8,
              height:       8,
              borderRadius: '50%',
              background:   'var(--color-accent)',
              display:      'block',
            }}
          />
        )}
      </span>

      {/* Label */}
      <span>
        <span
          style={{
            display:    'block',
            fontSize:   13,
            fontWeight: 500,
            color:      checked ? 'var(--color-accent)' : 'var(--color-ink)',
            lineHeight: 1.4,
          }}
        >
          {title}
        </span>
        <span
          style={{
            display:    'block',
            fontSize:   12,
            color:      'var(--color-ink-muted)',
            lineHeight: 1.6,
            marginTop:  2,
          }}
        >
          {hint}
        </span>
      </span>
    </button>
  )
}

// Toggle switch for illustrations
function IllustrationsToggle({
  on, title, hint, onChange,
}: {
  on:       boolean
  title:    string
  hint:     string
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="row-item"
      style={{
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'space-between',
        gap:          16,
        width:        '100%',
        padding:      '16px 20px',
        cursor:       'pointer',
        textAlign:    'left',
        fontFamily:   'var(--font-sans)',
        background:   'none',
        border:       '1px solid var(--color-border)',
      }}
    >
      <span>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-ink)' }}>
          {title}
        </span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--color-ink-muted)', lineHeight: 1.6, marginTop: 2 }}>
          {hint}
        </span>
      </span>

      {/* Switch track */}
      <span
        aria-hidden="true"
        style={{
          flexShrink:   0,
          width:        44,
          height:       24,
          borderRadius: 9999,
          background:   on ? 'var(--color-accent)' : 'var(--color-sunk)',
          position:     'relative',
          transition:   'background 150ms',
        }}
      >
        {/* Knob */}
        <span
          style={{
            position:     'absolute',
            top:          3,
            left:         on ? 'calc(100% - 21px)' : 3,
            width:        18,
            height:       18,
            borderRadius: '50%',
            background:   'var(--color-surface)',
            boxShadow:    'var(--shadow-card)',
            transition:   'left 150ms',
          }}
        />
      </span>
    </button>
  )
}

// Page-size option card
function SizeCard({
  size, label, sub, selected, onSelect,
}: {
  size:     'A4' | 'Letter'
  label:    string
  sub:      string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        flex:         1,
        padding:      '16px 0',
        borderRadius: 14,
        border:       selected ? 'none' : '1px solid var(--color-border)',
        background:   selected ? 'var(--color-accent-soft)' : 'var(--color-surface)',
        cursor:       'pointer',
        fontFamily:   'var(--font-sans)',
        textAlign:    'center',
        transition:   'background 150ms',
      }}
      onMouseEnter={e => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-sunk)'
      }}
      onMouseLeave={e => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)'
      }}
    >
      <span
        style={{
          display:    'block',
          fontSize:   14,
          fontWeight: 600,
          color:      selected ? 'var(--color-accent)' : 'var(--color-ink)',
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>
      <span
        style={{
          display:  'block',
          fontSize: 11,
          color:    selected ? 'var(--color-accent)' : 'var(--color-ink-muted)',
          opacity:  selected ? 0.7 : 1,
          marginTop: 3,
        }}
      >
        {sub}
      </span>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportPanel({
  config, topicCount, questionCount, onConfig, onClose, onPreview, onPrint,
}: ReportPanelProps) {
  const sheets = estimateSheets(config, topicCount, questionCount)
  const sheetLabel = sheets === 1 ? '1 sheet' : `${sheets} sheets`

  const estimateBody = config.kind === 'compliance'
    ? 'A record HR can keep on file: what was tested, how it was scored, and when.'
    : 'A summary a manager can skim: what Compass has covered with this person, and where each answer came from.'

  return (
    // Fixed full-screen layer, aligned to right, marked as non-printing
    <div
      data-no-print
      style={{
        position: 'fixed',
        inset:    0,
        zIndex:   50,
      }}
    >
      {/* Scrim — closes on click */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position:   'absolute',
          inset:      0,
          background: 'color-mix(in srgb, var(--color-ink) 25%, transparent)',
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Report options"
        className="animate-fade-up"
        style={{
          position:      'absolute',
          top:           0,
          right:         0,
          bottom:        0,
          width:         420,
          maxWidth:      '100vw',
          display:       'flex',
          flexDirection: 'column',
          background:    'var(--color-page)',
          boxShadow:     'var(--shadow-float)',
          overflow:      'hidden',
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '24px 28px 20px',
            flexShrink:     0,
            borderBottom:   '1px solid var(--color-border)',
          }}
        >
          <h2
            style={{
              margin:     0,
              fontSize:   18,
              fontWeight: 600,
              color:      'var(--color-ink)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Report
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report panel"
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              justifyContent: 'center',
              width:          36,
              height:         36,
              borderRadius:   '50%',
              border:         '1px solid var(--color-border)',
              background:     'var(--color-surface)',
              cursor:         'pointer',
              color:          'var(--color-ink-muted)',
              flexShrink:     0,
            }}
          >
            {/* 15px × close icon */}
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <path d="M2 2l11 11M13 2L2 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────── */}
        <div
          className="thin-scroll"
          style={{
            flex:      1,
            overflowY: 'auto',
            padding:   '24px 28px',
            display:   'flex',
            flexDirection: 'column',
            gap:       28,
          }}
        >
          {/* ── Group 1: Output type ─────────────────────────────────── */}
          <div>
            <GroupLabel>Output type</GroupLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <KindRow
                id="manager"
                title="Manager summary"
                hint={`Onboarding topics covered so far, organised by phase — all ${topicCount} topics, with sources.`}
                checked={config.kind === 'manager'}
                onSelect={() => onConfig({ ...config, kind: 'manager' })}
              />
              <KindRow
                id="compliance"
                title="Compliance evidence pack"
                hint={`Scored Tutor attempts for all ${questionCount} questions — pass/fail, timestamps and policy acknowledgement.`}
                checked={config.kind === 'compliance'}
                onSelect={() => onConfig({ ...config, kind: 'compliance' })}
              />
            </div>
          </div>

          {/* ── Group 2: Illustrations ───────────────────────────────── */}
          <div>
            <GroupLabel>Illustrations</GroupLabel>
            <IllustrationsToggle
              on={config.illustrations}
              title="Include illustrations"
              hint={config.illustrations ? 'One picture per item' : 'Text only — more items per sheet'}
              onChange={v => onConfig({ ...config, illustrations: v })}
            />
          </div>

          {/* ── Group 3: Page size ────────────────────────────────────── */}
          <div>
            <GroupLabel>Page size</GroupLabel>
            <div style={{ display: 'flex', gap: 10 }}>
              <SizeCard
                size="A4"
                label="A4"
                sub="210 × 297 mm"
                selected={config.pageSize === 'A4'}
                onSelect={() => onConfig({ ...config, pageSize: 'A4' })}
              />
              <SizeCard
                size="Letter"
                label="Letter"
                sub="8.5 × 11 in"
                selected={config.pageSize === 'Letter'}
                onSelect={() => onConfig({ ...config, pageSize: 'Letter' })}
              />
            </div>
          </div>

          {/* ── Estimate block ────────────────────────────────────────── */}
          <div
            style={{
              borderRadius: 14,
              background:   'var(--color-violet-soft)',
              padding:      20,
            }}
          >
            {/* Label row */}
            <div
              style={{
                display:        'flex',
                alignItems:     'baseline',
                justifyContent: 'space-between',
                marginBottom:   6,
              }}
            >
              <span
                style={{
                  fontSize:      11,
                  fontWeight:    500,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.12em',
                  color:         'var(--color-violet)',
                  opacity:       0.7,
                  fontFamily:    'var(--font-sans)',
                }}
              >
                Estimated output
              </span>
              <span
                style={{
                  fontSize:      11,
                  fontWeight:    600,
                  fontVariantNumeric: 'tabular-nums',
                  color:         'var(--color-violet)',
                  fontFamily:    'var(--font-sans)',
                }}
              >
                {sheetLabel}
              </span>
            </div>
            <p
              style={{
                margin:     0,
                fontSize:   12,
                lineHeight: 1.7,
                color:      'var(--color-ink-muted)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {estimateBody}
            </p>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: '1fr 1fr',
            gap:                 10,
            padding:             '16px 28px 24px',
            flexShrink:          0,
            borderTop:           '1px solid var(--color-border)',
          }}
        >
          <button
            type="button"
            onClick={onPreview}
            className="btn-secondary"
          >
            {/* 15px eye icon */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Preview
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="btn-primary"
          >
            {/* 15px download icon */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export PDF
          </button>
        </div>
      </div>
    </div>
  )
}
