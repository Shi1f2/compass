/**
 * components/pdf/PdfPreview.tsx
 *
 * Exported document: one of two reports.
 *
 *   Manager summary     — what Compass has covered with this person: every
 *                         onboarding topic organised by phase, with sources,
 *                         illustrations and the policy acknowledgements panel.
 *
 *   Compliance pack     — scored Tutor attempts: every question attempted,
 *                         timestamped, with pass/fail, the marked answer, the
 *                         explanation and the acknowledgement sentence HR keeps
 *                         on file.
 *
 * Both share the same sheet furniture: a masthead with the lockup and page
 * counter, a two-column body (picture grid left, detail column right), and a
 * specification strip along the foot of every sheet.  The aesthetic is the
 * printed instruction leaflet that ships in the box with a consumer product:
 * clean, numbered, readable at arm's length.
 *
 * Styling approach:  the sheet is drawn with inline styles rather than utility
 * classes because print sizing is all in millimetres and points — Tailwind
 * utility classes cannot express those units.  Every colour still resolves
 * through the same palette as the screen UI (--color-ink, --color-accent, etc.).
 * The one exception is the paper fill: a printed sheet is white stock, not the
 * app's warm off-white page background.  The font family is held in one named
 * constant (LABEL_FACE) so the many call sites that read it keep one meaning.
 *
 * Per-sheet counts:
 *   TOPICS_PER_SHEET    = 6   — two-by-three grid, illustrations large enough to read
 *   QUESTIONS_PER_SHEET = 4   — compliance cells are taller (picture + result + ack),
 *                               so fewer fit before the detail column runs out of room
 *                               on the shorter Letter sheet
 *
 * These constants are exported so the report panel can import them and compute
 * an estimate that can never disagree with what actually renders here.
 */
'use client'

import { X, Printer } from 'lucide-react'
import type { Profile, Topic, Question } from '@/lib/types'
import type { ExportConfig } from '@/components/console/ReportPanel'
import { NOT_ATTEMPTED } from '@/lib/quizGroup'
import { Mark, Wordmark } from '@/components/Wordmark'
import { SoftwareFrame } from '@/components/screens/SoftwareFrame'

// ─── Per-sheet counts (exported so ReportPanel can import them) ───────────────

/** Six topics in a two-by-three grid keeps the illustrations large enough to read. */
export const TOPICS_PER_SHEET = 6

/**
 * Compliance cells carry more per item — a picture, a result line and an
 * acknowledgement — so fewer fit before the detail column runs out of room on
 * the shorter Letter sheet.
 */
export const QUESTIONS_PER_SHEET = 4

// ─── Font constant ────────────────────────────────────────────────────────────

/** Single named constant for the label face — every call site means one thing. */
const LABEL_FACE = "'Poppins', ui-rounded, 'Nunito Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"

// ─── Sheet geometry ───────────────────────────────────────────────────────────

/**
 * A4:     210 × 297 mm   →   sheet drawn at 296 mm high
 * Letter: 215.9 × 279.4 mm → sheet drawn at 278.4 mm high
 *
 * Each page is drawn 1 mm shorter than its sheet.  Sub-pixel rounding in
 * Chrome can otherwise push a blank extra sheet between pages when the
 * accumulated height lands exactly on a page boundary.
 */
const SHEET = {
  A4:     { width: '210mm', height: '296mm' },
  Letter: { width: '215.9mm', height: '278.4mm' },
} as const

// Padding: 12mm top, 13mm sides, 10mm bottom (leaves 80mm for footer on short side)
const PAD = { top: '12mm', side: '13mm', bottom: '10mm' }

// Body grid: 118mm picture grid, 8mm gap, 58mm detail column = 184mm on A4
const GRID_PICTURE = '118mm'
const GRID_GAP     = '8mm'
const GRID_DETAIL  = '58mm'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PdfPreviewProps {
  profile:  Profile
  config:   ExportConfig
  onClose:  () => void
}

// ─── Chunk helper ─────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ─── Date helper ─────────────────────────────────────────────────────────────

function printedDate(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Circled item number ──────────────────────────────────────────────────────

/**
 * Filled ink disc 5.6mm across, paper-coloured text at 1.5× that in points,
 * semibold and centred — as on a printed instruction leaflet.
 */
function Disc({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        width:          '5.6mm',
        height:         '5.6mm',
        borderRadius:   '50%',
        background:     'var(--color-ink)',
        color:          'var(--color-paper)',
        fontSize:       '8.4pt', // 1.5 × 5.6
        fontWeight:     600,
        fontFamily:     LABEL_FACE,
        flexShrink:     0,
        lineHeight:     1,
      }}
    >
      {n}
    </span>
  )
}

// ─── Panel shell (shared by detail and policy panels) ────────────────────────

function Panel({
  title, icon, children,
}: {
  title:    string
  icon?:    React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        border:       '0.6pt solid var(--color-ink)',
        borderRadius: '2mm',
        padding:      '3mm',
        breakInside:  'avoid',
        fontFamily:   LABEL_FACE,
      }}
    >
      <div
        style={{
          display:       'flex',
          alignItems:    'center',
          gap:           '2mm',
          marginBottom:  '2.5mm',
          paddingBottom: '2mm',
          borderBottom:  '0.4pt solid var(--color-sunk)',
        }}
      >
        {icon}
        <span
          style={{
            fontSize:   '8.5pt',
            fontWeight: 700,
            color:      'var(--color-ink)',
            fontFamily: LABEL_FACE,
          }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

// ─── Warning triangle (inline SVG drawn for the policy panel) ─────────────────

function WarningTriangle() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {/* Triangle outline */}
      <path
        d="M12 3L2 21h20L12 3z"
        stroke="var(--color-ink)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Exclamation bar */}
      <line x1="12" y1="10" x2="12" y2="15" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round"/>
      {/* Exclamation dot */}
      <circle cx="12" cy="18" r="1" fill="var(--color-ink)"/>
    </svg>
  )
}

// ─── Masthead ─────────────────────────────────────────────────────────────────

function Masthead({
  profile, config, pageNum, totalPages,
}: {
  profile:    Profile
  config:     ExportConfig
  pageNum:    number
  totalPages: number
}) {
  const kindLine = config.kind === 'compliance' ? 'Compliance evidence pack' : 'Manager summary'
  return (
    <div style={{ fontFamily: LABEL_FACE }}>
      <div
        style={{
          display:        'flex',
          alignItems:     'flex-start',
          justifyContent: 'space-between',
          marginBottom:   '2mm',
        }}
      >
        {/* Left: stacked lockup */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2.5mm' }}>
          <Mark size={14} />
          <div>
            <div
              style={{
                fontSize:      '14pt',
                fontWeight:    600,
                lineHeight:    1.2,
                letterSpacing: '-0.01em',
                color:         'var(--color-ink)',
                fontFamily:    LABEL_FACE,
              }}
            >
              {profile.title}
            </div>
            <div
              style={{
                fontSize:   '8pt',
                color:      'var(--color-ink-muted)',
                marginTop:  '0.8mm',
                fontFamily: LABEL_FACE,
              }}
            >
              {config.kind === 'compliance' ? kindLine : profile.subtitle}
            </div>
          </div>
        </div>

        {/* Right: date + page counter */}
        <div
          style={{
            fontSize:   '6.5pt',
            color:      'var(--color-ink-muted)',
            textAlign:  'right',
            fontFamily: LABEL_FACE,
            lineHeight: 1.6,
            opacity:    0.6,
          }}
        >
          <div>{printedDate()}</div>
          <div>Page {pageNum} / {totalPages}</div>
        </div>
      </div>

      {/* 1pt rule */}
      <div
        style={{
          height:     '1pt',
          background: 'var(--color-ink)',
          marginTop:  '2mm',
        }}
      />
    </div>
  )
}

// ─── Detail panel: topic detail ───────────────────────────────────────────────

function TopicDetailPanel({ topics }: { topics: Topic[] }) {
  return (
    <Panel title="Topic details">
      <div style={{ display: 'grid', gridTemplateColumns: '5.5mm 1fr', gap: '1.5mm 2mm' }}>
        {topics.map((t, i) => (
          <>
            <span
              key={`n-${t.id}`}
              style={{
                fontSize:   '7pt',
                fontWeight: 700,
                color:      'var(--color-accent)',
                fontFamily: LABEL_FACE,
                paddingTop: '0.5mm',
              }}
            >
              {i + 1}
            </span>
            <div key={`d-${t.id}`}>
              <div
                style={{
                  fontSize:   '7pt',
                  lineHeight: 1.4,
                  color:      'var(--color-ink)',
                  fontFamily: LABEL_FACE,
                  marginBottom: t.note && t.note.kind !== 'none' ? '1mm' : 0,
                }}
              >
                {t.detail}
              </div>
              <div
                style={{
                  fontSize:   '6.5pt',
                  color:      'var(--color-ink-muted)',
                  fontFamily: LABEL_FACE,
                  opacity:    0.7,
                  marginBottom: t.note && t.note.kind !== 'none' ? '1mm' : 0,
                }}
              >
                Source: {t.system}
              </div>
              {t.note && t.note.kind !== 'none' && (
                <div
                  style={{
                    borderLeft:  `1pt solid ${t.note.kind === 'warning' ? 'var(--color-waiting)' : 'var(--color-accent)'}`,
                    paddingLeft: '2mm',
                    marginTop:   '1mm',
                    marginBottom: '1mm',
                  }}
                >
                  <span
                    style={{
                      fontSize:      '6pt',
                      fontWeight:    700,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.05em',
                      color:         t.note.kind === 'warning' ? 'var(--color-waiting)' : 'var(--color-accent)',
                      fontFamily:    LABEL_FACE,
                    }}
                  >
                    {t.note.kind === 'warning' ? 'Warning' : 'Tip'}
                  </span>
                  {' '}
                  <span style={{ fontSize: '6pt', color: 'var(--color-ink-muted)', fontFamily: LABEL_FACE }}>
                    {t.note.text}
                  </span>
                </div>
              )}
            </div>
          </>
        ))}
      </div>
    </Panel>
  )
}

// ─── Detail panel: compliance (scored attempts) ───────────────────────────────

function ComplianceDetailPanel({ questions }: { questions: Question[] }) {
  return (
    <Panel title="Scored attempts">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2mm' }}>
        {questions.map((q, i) => {
          const attempted = q.result && q.result.attemptedAt !== NOT_ATTEMPTED
          return (
            <div key={q.id} style={{ paddingBottom: '2mm', borderBottom: i < questions.length - 1 ? '0.3pt solid var(--color-sunk)' : 'none' }}>
              <span
                style={{
                  fontSize:   '7pt',
                  fontWeight: 700,
                  color:      'var(--color-accent)',
                  fontFamily: LABEL_FACE,
                }}
              >
                {i + 1}
              </span>
              {' '}
              {attempted && q.explanation && (
                <span style={{ fontSize: '7pt', color: 'var(--color-ink)', fontFamily: LABEL_FACE, lineHeight: 1.4 }}>
                  {q.explanation}
                </span>
              )}
              {attempted && q.result?.acknowledgement && (
                <div style={{ fontSize: '6.5pt', color: 'var(--color-ink-muted)', fontFamily: LABEL_FACE, opacity: 0.7, marginTop: '1mm' }}>
                  {q.result.acknowledgement}
                </div>
              )}
              {!attempted && (
                <span style={{ fontSize: '7pt', color: 'var(--color-locked)', fontFamily: LABEL_FACE }}>Not attempted</span>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

// ─── Policy panel (first sheet only) ─────────────────────────────────────────

function PolicyPanel({ usageNotes }: { usageNotes: string[] }) {
  return (
    <Panel title="Policy acknowledgements" icon={<WarningTriangle />}>
      <ul
        style={{
          margin:     0,
          padding:    0,
          listStyle:  'none',
          display:    'flex',
          flexDirection: 'column',
          gap:        '1.5mm',
        }}
      >
        {usageNotes.map((note, i) => (
          <li
            key={i}
            style={{
              display:    'flex',
              gap:        '2mm',
              fontSize:   '6.8pt',
              color:      'var(--color-ink)',
              fontFamily: LABEL_FACE,
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: 'var(--color-accent)', flexShrink: 0, fontWeight: 700 }}>•</span>
            {note}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

// ─── Spec strip ───────────────────────────────────────────────────────────────

function SpecStrip({
  profile, config, pageNum, totalPages, itemCount,
}: {
  profile:    Profile
  config:     ExportConfig
  pageNum:    number
  totalPages: number
  itemCount:  number
}) {
  return (
    <div style={{ fontFamily: LABEL_FACE }}>
      {/* 0.6pt rule */}
      <div style={{ height: '0.6pt', background: 'var(--color-ink)', marginBottom: '2mm' }} />

      {/* Spec row */}
      <div
        style={{
          display:    'flex',
          flexWrap:   'wrap',
          gap:        '0 6mm',
          alignItems: 'baseline',
        }}
      >
        <span
          style={{
            fontSize:      '6pt',
            fontWeight:    700,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.09em',
            color:         'var(--color-ink)',
            fontFamily:    LABEL_FACE,
            whiteSpace:    'nowrap',
          }}
        >
          Employee record
        </span>
        {profile.specRows.map((row, i) => (
          <span
            key={i}
            style={{
              fontSize:   '6.5pt',
              whiteSpace: 'nowrap',
              fontFamily: LABEL_FACE,
            }}
          >
            <span style={{ color: 'var(--color-ink-muted)', opacity: 0.65 }}>{row.label} </span>
            <span style={{ color: 'var(--color-ink)' }}>{row.value}</span>
          </span>
        ))}
      </div>

      {/* 0.4pt hairline */}
      <div style={{ height: '0.4pt', background: 'var(--color-sunk)', margin: '1.5mm 0' }} />

      {/* Footer row */}
      <div
        style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'baseline',
          fontSize:       '6pt',
          color:          'var(--color-ink-muted)',
          fontFamily:     LABEL_FACE,
          opacity:        0.65,
        }}
      >
        <span>
          <Wordmark color="inherit" size={8} weight={600} />
          {' — Prepared with Compass'}
        </span>
        <span>
          {itemCount} {config.kind === 'compliance' ? 'questions' : 'topics'} · Page {pageNum} / {totalPages}
        </span>
      </div>
    </div>
  )
}

// ─── Topic picture grid (with illustrations) ──────────────────────────────────

function TopicGrid({ topics }: { topics: Topic[] }) {
  /**
   * Fixed 2×3 grid with explicit row count — a part-full last sheet then keeps
   * identical cell sizes because the grid doesn't collapse empty trailing rows.
   */
  return (
    <div
      style={{
        display:               'grid',
        gridTemplateColumns:   '1fr 1fr',
        gridTemplateRows:      'repeat(3, 1fr)',
        gap:                   '4mm',
        height:                '100%',
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => {
        const t = topics[i]
        if (!t) {
          return <div key={i} />
        }
        return (
          <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '1.5mm', overflow: 'hidden' }}>
            {/* Number + title row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2mm' }}>
              <Disc n={i + 1} />
              <span
                style={{
                  fontSize:   '8.5pt',
                  fontWeight: 600,
                  color:      'var(--color-ink)',
                  fontFamily: LABEL_FACE,
                  lineHeight: 1.2,
                  flex:       1,
                }}
              >
                {t.title}
              </span>
            </div>

            {/* Frame illustration */}
            {t.scene && (
              <div
                style={{
                  border:       '0.6pt solid var(--color-ink)',
                  borderRadius: '1mm',
                  overflow:     'hidden',
                  flex:         '0 0 auto',
                  aspectRatio:  '960 / 600',
                  width:        '100%',
                }}
              >
                <SoftwareFrame scene={t.scene} />
              </div>
            )}

            {/* Answer */}
            <p
              style={{
                margin:     0,
                fontSize:   '7pt',
                lineHeight: 1.42,
                color:      'var(--color-ink)',
                fontFamily: LABEL_FACE,
                flex:       1,
                overflow:   'hidden',
              }}
            >
              {t.answer}
            </p>

            {/* Note reference line */}
            {t.note && t.note.kind !== 'none' && (
              <p
                style={{
                  margin:        0,
                  fontSize:      '6pt',
                  fontWeight:    600,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.06em',
                  color:         t.note.kind === 'warning' ? 'var(--color-waiting)' : 'var(--color-accent)',
                  fontFamily:    LABEL_FACE,
                }}
              >
                {t.note.kind === 'warning' ? 'Warning' : 'Tip'} — see detail {/* item number shown inline */}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Topic list (without illustrations) ──────────────────────────────────────

function TopicList({ topics }: { topics: Topic[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {topics.map((t, i) => (
        <div
          key={t.id}
          style={{
            paddingBottom: '3mm',
            marginBottom:  '3mm',
            borderBottom:  i < topics.length - 1 ? '0.4pt solid var(--color-sunk)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2mm', marginBottom: '1mm' }}>
            <Disc n={i + 1} />
            <span
              style={{
                fontSize:   '9.5pt',
                fontWeight: 600,
                color:      'var(--color-ink)',
                fontFamily: LABEL_FACE,
                lineHeight: 1.2,
              }}
            >
              {t.title}
            </span>
          </div>
          <p
            style={{
              margin:     0,
              fontSize:   '8pt',
              lineHeight: 1.5,
              color:      'var(--color-ink)',
              fontFamily: LABEL_FACE,
              paddingLeft: '7.6mm', // disc width + gap
            }}
          >
            {t.answer}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Compliance question grid (with illustrations) ────────────────────────────

function QuestionGrid({ questions }: { questions: Question[] }) {
  /**
   * Fixed 2×2 grid with explicit row count — part-full last sheet keeps
   * identical cell sizes (same rationale as TopicGrid).
   */
  return (
    <div
      style={{
        display:             'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows:    'repeat(2, 1fr)',
        gap:                 '4mm',
        height:              '100%',
      }}
    >
      {Array.from({ length: 4 }).map((_, i) => {
        const q = questions[i]
        if (!q) return <div key={i} />

        const attempted = q.result && q.result.attemptedAt !== NOT_ATTEMPTED
        const passed    = attempted && q.result!.correct
        const score     = q.result?.score ?? 0
        const resultColor = q.kind === 'written'
          ? (score >= 80 ? 'var(--color-correct)' : score >= 50 ? 'var(--color-waiting)' : 'var(--color-incorrect)')
          : (passed ? 'var(--color-correct)' : 'var(--color-incorrect)')
        const resultLabel = q.kind === 'written'
          ? `${score}%`
          : (passed ? 'Pass' : 'Fail')

        return (
          <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: '1.5mm', overflow: 'hidden' }}>
            {/* Number + prompt */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2mm' }}>
              <Disc n={i + 1} />
              <span
                style={{
                  fontSize:   '8.5pt',
                  fontWeight: 600,
                  color:      'var(--color-ink)',
                  fontFamily: LABEL_FACE,
                  lineHeight: 1.2,
                  flex:       1,
                }}
              >
                {q.prompt}
              </span>
            </div>

            {/* Frame illustration */}
            {q.scene && (
              <div
                style={{
                  border:       '0.6pt solid var(--color-ink)',
                  borderRadius: '1mm',
                  overflow:     'hidden',
                  flex:         '0 0 auto',
                  aspectRatio:  '960 / 600',
                  width:        '100%',
                }}
              >
                <SoftwareFrame scene={q.scene} />
              </div>
            )}

            {/* Result line */}
            {attempted ? (
              <div
                style={{
                  display:    'flex',
                  gap:        '2mm',
                  alignItems: 'baseline',
                  fontSize:   '7pt',
                  fontFamily: LABEL_FACE,
                }}
              >
                <span style={{ fontWeight: 700, color: resultColor }}>{resultLabel}</span>
                <span style={{ color: 'var(--color-ink-muted)', fontSize: '6.5pt', opacity: 0.75 }}>
                  {q.result!.attemptedAt}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: '6.5pt', color: 'var(--color-locked)', fontFamily: LABEL_FACE }}>Not attempted</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Compliance question list (without illustrations) ─────────────────────────

function QuestionList({ questions }: { questions: Question[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {questions.map((q, i) => {
        const attempted = q.result && q.result.attemptedAt !== NOT_ATTEMPTED
        const passed    = attempted && q.result!.correct
        const score     = q.result?.score ?? 0

        return (
          <div
            key={q.id}
            style={{
              paddingBottom: '3mm',
              marginBottom:  '3mm',
              borderBottom:  i < questions.length - 1 ? '0.4pt solid var(--color-sunk)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2mm', marginBottom: '1mm' }}>
              <Disc n={i + 1} />
              <span
                style={{
                  fontSize:   '9.5pt',
                  fontWeight: 600,
                  color:      'var(--color-ink)',
                  fontFamily: LABEL_FACE,
                  lineHeight: 1.2,
                  flex:       1,
                }}
              >
                {q.prompt}
              </span>
            </div>
            {attempted && (
              <div style={{ paddingLeft: '7.6mm', fontSize: '8pt', fontFamily: LABEL_FACE, lineHeight: 1.5 }}>
                <span
                  style={{
                    fontWeight: 700,
                    color: q.kind === 'written'
                      ? (score >= 80 ? 'var(--color-correct)' : score >= 50 ? 'var(--color-waiting)' : 'var(--color-incorrect)')
                      : (passed ? 'var(--color-correct)' : 'var(--color-incorrect)'),
                  }}
                >
                  {q.kind === 'written' ? `${score}%` : (passed ? 'Pass' : 'Fail')}
                </span>
                {' · '}
                <span style={{ color: 'var(--color-ink-muted)' }}>{q.result!.attemptedAt}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── One printed sheet ────────────────────────────────────────────────────────

function Sheet({
  profile, config, pageNum, totalPages, items, isFirst, isCompliance,
}: {
  profile:      Profile
  config:       ExportConfig
  pageNum:      number
  totalPages:   number
  items:        Topic[] | Question[]
  isFirst:      boolean
  isCompliance: boolean
}) {
  const ps   = config.pageSize
  const dims = SHEET[ps]
  const totalItems = isCompliance
    ? profile.quiz.length
    : profile.topics.length

  return (
    <div
      className="sheet"
      style={{
        width:         dims.width,
        height:        dims.height,
        padding:       `${PAD.top} ${PAD.side} ${PAD.bottom}`,
        background:    'var(--color-paper)',
        color:         'var(--color-ink)',
        fontFamily:    LABEL_FACE,
        display:       'flex',
        flexDirection: 'column',
        overflow:      'hidden',
        boxSizing:     'border-box',
      }}
    >
      {/* Masthead */}
      <Masthead profile={profile} config={config} pageNum={pageNum} totalPages={totalPages} />

      {/* Body grid — 5mm below masthead */}
      <div
        style={{
          marginTop:           '5mm',
          flex:                1,
          display:             'grid',
          gridTemplateColumns: `${GRID_PICTURE} ${GRID_GAP} ${GRID_DETAIL}`,
          overflow:            'hidden',
          minHeight:           0,
        }}
      >
        {/* Picture grid column */}
        <div style={{ overflow: 'hidden' }}>
          {isCompliance ? (
            config.illustrations
              ? <QuestionGrid questions={items as Question[]} />
              : <QuestionList questions={items as Question[]} />
          ) : (
            config.illustrations
              ? <TopicGrid topics={items as Topic[]} />
              : <TopicList topics={items as Topic[]} />
          )}
        </div>

        {/* Gap column — empty spacer */}
        <div />

        {/* Detail column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4mm', overflow: 'hidden' }}>
          {isCompliance
            ? <ComplianceDetailPanel questions={items as Question[]} />
            : <TopicDetailPanel topics={items as Topic[]} />
          }
          {isFirst && profile.usageNotes.length > 0 && (
            <PolicyPanel usageNotes={profile.usageNotes} />
          )}
        </div>
      </div>

      {/* Specification strip */}
      <SpecStrip
        profile={profile}
        config={config}
        pageNum={pageNum}
        totalPages={totalPages}
        itemCount={totalItems}
      />
    </div>
  )
}

// ─── PdfPreview ───────────────────────────────────────────────────────────────

export default function PdfPreview({ profile, config, onClose }: PdfPreviewProps) {
  const isCompliance   = config.kind === 'compliance'
  const topicChunks    = chunk(profile.topics, TOPICS_PER_SHEET)
  const questionChunks = chunk(profile.quiz, QUESTIONS_PER_SHEET)
  const chunks         = isCompliance ? questionChunks : topicChunks
  const totalPages     = chunks.length
  const ps             = config.pageSize

  // The @page rule injected here tells the browser's print dialog to use the
  // chosen sheet size with no margin, so the sheet element fills the page exactly.
  const pageCSS = `@page { size: ${ps === 'A4' ? '210mm 297mm' : '215.9mm 279.4mm'}; margin: 0; }`

  const kindLabel = isCompliance ? 'Compliance evidence pack' : 'Manager summary'
  const sheetWord = totalPages === 1 ? 'sheet' : 'sheets'

  return (
    <div
      id="print-root"
      style={{
        position:   'fixed',
        inset:      0,
        background: 'var(--color-ink)',
        zIndex:     60,
        display:    'flex',
        flexDirection: 'column',
        overflow:   'hidden',
      }}
    >
      {/* Inject @page rule for print size */}
      <style>{pageCSS}</style>

      {/* Non-printing dark toolbar */}
      <div
        data-no-print
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            12,
          padding:        '10px 20px',
          background:     'color-mix(in srgb, var(--color-ink) 96%, transparent)',
          borderBottom:   '1px solid color-mix(in srgb, var(--color-surface) 8%, transparent)',
          flexShrink:     0,
          zIndex:         1,
        }}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:          32,
            height:         32,
            borderRadius:   '50%',
            border:         '1px solid color-mix(in srgb, var(--color-surface) 20%, transparent)',
            background:     'transparent',
            color:          'var(--color-surface)',
            cursor:         'pointer',
            flexShrink:     0,
          }}
        >
          <X size={14} strokeWidth={2} />
        </button>

        {/* Title block */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-surface)', fontFamily: LABEL_FACE, lineHeight: 1.3 }}>
            {profile.title}
          </div>
          <div style={{ fontSize: 11, color: 'color-mix(in srgb, var(--color-surface) 55%, transparent)', fontFamily: LABEL_FACE }}>
            {kindLabel} · {ps} · {totalPages} {sheetWord}
          </div>
        </div>

        {/* Export PDF button */}
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          7,
            padding:      '9px 20px',
            borderRadius: 9999,
            border:       'none',
            background:   'var(--color-accent)',
            color:        '#fff',
            fontSize:     13,
            fontWeight:   600,
            cursor:       'pointer',
            fontFamily:   LABEL_FACE,
            flexShrink:   0,
          }}
        >
          <Printer size={14} strokeWidth={2} />
          Export PDF
        </button>
      </div>

      {/* Scrolling sheet stack — marked for print styles to find */}
      <div
        className="pdf-preview-scroll thin-scroll"
        style={{
          flex:           1,
          overflowY:      'auto',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          padding:        '24px 0 48px',
        }}
      >
        {/* Sheet stack — block display on print (flex won't fragment in Chrome) */}
        <div
          className="sheet-stack"
          style={{
            display:       'flex',
            flexDirection: 'column',
            gap:           24,
            alignItems:    'center',
          }}
        >
          {isCompliance
            ? questionChunks.map((items, idx) => (
                <Sheet
                  key={idx}
                  profile={profile}
                  config={config}
                  pageNum={idx + 1}
                  totalPages={totalPages}
                  items={items}
                  isFirst={idx === 0}
                  isCompliance={true}
                />
              ))
            : topicChunks.map((items, idx) => (
                <Sheet
                  key={idx}
                  profile={profile}
                  config={config}
                  pageNum={idx + 1}
                  totalPages={totalPages}
                  items={items}
                  isFirst={idx === 0}
                  isCompliance={false}
                />
              ))
          }
        </div>

        {/* Non-printing footnote */}
        <div
          data-no-print
          style={{
            marginTop:  32,
            display:    'flex',
            alignItems: 'center',
            gap:        7,
            fontSize:   12,
            color:      'color-mix(in srgb, var(--color-surface) 40%, transparent)',
            fontFamily: LABEL_FACE,
          }}
        >
          <Printer size={13} strokeWidth={1.5} />
          Export PDF opens the browser print dialog — choose &ldquo;Save as PDF&rdquo;.
        </div>
      </div>
    </div>
  )
}
