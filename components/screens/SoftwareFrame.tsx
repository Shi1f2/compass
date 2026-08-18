/**
 * components/screens/SoftwareFrame.tsx
 * A mock screenshot of "Brightfield", a fictional client intranet with Compass
 * embedded in it. Drawn entirely in SVG — no image files, no external fonts,
 * no client-side JavaScript. One component with many views, driven by Scene.
 */

import type { Scene } from '@/lib/types'

// ─── Exported dimensions ─────────────────────────────────────────────────────

export const FRAME_WIDTH  = 960
export const FRAME_HEIGHT = 600

// ─── Brightfield palette ─────────────────────────────────────────────────────

/**
 * These colours belong to Brightfield, a deliberately different fictional
 * product. They must never be replaced with Compass's own palette — doing so
 * would make the host intranet look like it was built by Compass.
 */
const BF = {
  windowChrome:    '#DEDAD4',
  chromeEdge:      '#C8C3BB',
  activeTab:       '#F4F2EE',
  sidebar:         '#22262B',
  sidebarActiveRow:'#2E343B',
  sidebarText:     '#9DA5AD',
  appBackground:   '#F6F5F3',
  panel:           '#FFFFFF',
  hairline:        '#E4E1DC',
  harderLine:      '#D3CFC8',
  text:            '#23282E',
  muted:           '#7A746D',
  faint:           '#A9A29A',
  shade:           '#EFEDE9',
  blue:            '#2563EB',
  blueTint:        '#EAF0FE',
  green:           '#167A4B',
  greenTint:       '#E4F3EA',
  amber:           '#8A6100',
  amberTint:       '#FBF2D9',
  red:             '#B3261E',
  redTint:         '#FBEAE8',
  // These two track the Compass app palette — used only for Compass UI elements
  accent:          'var(--color-accent)',
  accentSoft:      'var(--color-accent-soft)',
} as const

// ─── Brightfield typefaces ────────────────────────────────────────────────────

// Both belong to the host product. Neither is loaded — the system fallbacks are
// what render, which is intentional.
const SANS  = `'IBM Plex Sans', system-ui, -apple-system, sans-serif`
const MONO  = `'IBM Plex Mono', 'Courier New', monospace`

// ─── Navigation entries ───────────────────────────────────────────────────────

const NAV_ITEMS = ['Home', 'People', 'IT Support', 'Documents', 'Projects', 'Expenses', 'Compass']

// ─── View metadata ────────────────────────────────────────────────────────────

const VIEW_META: Record<string, { title: string; path: string }> = {
  'portal-home':   { title: 'Home',              path: '/home' },
  'hris-record':   { title: 'People',            path: '/people/profile' },
  'itsm-ticket':   { title: 'IT Support',        path: '/it/tickets' },
  'docs-article':  { title: 'Documents',         path: '/docs/policies' },
  'comms-thread':  { title: 'Compass',           path: '/compass/chat' },
  'project-board': { title: 'Projects',          path: '/projects/board' },
  'expense-claim': { title: 'Expenses',          path: '/expenses/new' },
  'quiz':          { title: 'Compass · Tutor',   path: '/compass/tutor' },
}

// ─── Status chip colours ──────────────────────────────────────────────────────

function statusColors(label: string): { bg: string; color: string } {
  switch (label) {
    case 'New':
    case 'Open':            return { bg: BF.blueTint,  color: BF.blue }
    case 'In progress':
    case 'Pending':         return { bg: BF.amberTint, color: BF.amber }
    case 'Approved':
    case 'Resolved':
    case 'Standard':        return { bg: BF.greenTint, color: BF.green }
    case 'Restricted':      return { bg: BF.redTint,   color: BF.red }
    case 'Closed':
    case 'Not applicable':
    default:                return { bg: BF.shade,     color: BF.muted }
  }
}

// ─── Initials helper ──────────────────────────────────────────────────────────

function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  const first = words[0]?.[0] ?? ''
  const last  = words[words.length - 1]?.[0] ?? ''
  return (first + last).toUpperCase()
}

// ─── Content geometry ─────────────────────────────────────────────────────────

const SIDEBAR_W  = 196
const CONTENT_X  = SIDEBAR_W          // 196
const CONTENT_W  = FRAME_WIDTH - SIDEBAR_W  // 764
const CONTENT_Y  = 98                 // below chrome (62) + top bar (36)

// ─── Primitives ───────────────────────────────────────────────────────────────

interface TextProps {
  x: number; y: number; children: string
  size?: number; fill?: string; weight?: string
  anchor?: 'start' | 'middle' | 'end'
  mono?: boolean; opacity?: number
}
function T({ x, y, children, size = 12, fill = BF.text, weight = 'normal', anchor = 'start', mono = false, opacity }: TextProps) {
  return (
    <text
      x={x} y={y}
      fontSize={size}
      fill={fill}
      fontWeight={weight}
      textAnchor={anchor}
      fontFamily={mono ? MONO : SANS}
      dominantBaseline="central"
      opacity={opacity}
    >{children}</text>
  )
}

interface BarProps { x: number; y: number; w: number; h?: number }
function Bar({ x, y, w, h = 7 }: BarProps) {
  return <rect x={x} y={y - h / 2} width={w} height={h} rx={3} fill={BF.shade} />
}

interface PanelProps {
  x: number; y: number; w: number; h: number; rx?: number
  children?: React.ReactNode
}
function Panel({ x, y, w, h, rx = 10, children }: PanelProps) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={BF.panel} stroke={BF.hairline} strokeWidth={1} />
      {children}
    </g>
  )
}

interface BtnProps {
  x: number; y: number; w: number; h?: number; label: string
  variant?: 'accent' | 'default'
}
function Btn({ x, y, w, h = 26, label, variant = 'default' }: BtnProps) {
  const bg     = variant === 'accent' ? BF.accent : BF.panel
  const border = variant === 'accent' ? 'none'    : BF.harderLine
  const color  = variant === 'accent' ? '#fff'    : BF.text
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={13} fill={bg} stroke={border} strokeWidth={1} />
      <T x={x + w / 2} y={y + h / 2} anchor="middle" fill={color} size={11} weight="500">{label}</T>
    </g>
  )
}

interface FieldProps {
  x: number; y: number; w: number
  label: string; value: string; focused?: boolean
}
function Field({ x, y, w, label, value, focused = false }: FieldProps) {
  const borderColor = focused ? BF.accent : BF.harderLine
  return (
    <g>
      <T x={x} y={y} fill={BF.muted} size={10}>{label}</T>
      <rect x={x} y={y + 8} width={w} height={26} rx={6} fill={BF.panel} stroke={borderColor} strokeWidth={focused ? 1.5 : 1} />
      {focused && <rect x={x - 2} y={y + 6} width={w + 4} height={30} rx={8} fill="none" stroke={BF.accent} strokeWidth={0.5} opacity={0.3} />}
      <T x={x + 8} y={y + 21} fill={value ? BF.text : BF.faint} size={11}>{value || label}</T>
    </g>
  )
}

interface ChipProps { x: number; y: number; label: string }
function Chip({ x, y, label }: ChipProps) {
  const { bg, color } = statusColors(label)
  const w = label.length * 6.5 + 12
  return (
    <g>
      <rect x={x} y={y - 9} width={w} height={18} rx={9} fill={bg} />
      <T x={x + w / 2} y={y} anchor="middle" fill={color} size={10} weight="500">{label}</T>
    </g>
  )
}

function CompassGlyph({ cx, cy, r = 16 }: { cx: number; cy: number; r?: number }) {
  const d = r * 0.32
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={BF.accent} />
      <rect
        x={cx - d} y={cy - d}
        width={d * 2} height={d * 2}
        rx={1.5}
        fill="none" stroke="#fff" strokeWidth={1.5}
        transform={`rotate(45 ${cx} ${cy})`}
      />
    </g>
  )
}

function BrowserChrome({ tabTitle, path }: { tabTitle: string; path: string }) {
  return (
    <g>
      {/* Window bar */}
      <rect x={0} y={0} width={FRAME_WIDTH} height={36} fill={BF.windowChrome} />
      {/* Traffic lights */}
      <circle cx={18} cy={18} r={5} fill="#FF5F57" />
      <circle cx={32} cy={18} r={5} fill="#FFBD2E" />
      <circle cx={46} cy={18} r={5} fill="#28CA41" />
      {/* Active tab */}
      <rect x={72} y={8} width={160} height={28} rx={6} fill={BF.activeTab} />
      <T x={152} y={22} anchor="middle" size={11} fill={BF.text}>{tabTitle}</T>
      {/* Address bar */}
      <rect x={250} y={10} width={460} height={22} rx={5} fill={BF.activeTab} stroke={BF.chromeEdge} strokeWidth={1} />
      <T x={480} y={21} anchor="middle" size={10} fill={BF.muted} mono>{'brightfield.intranet' + path}</T>
    </g>
  )
}

interface SidebarProps {
  activeIndex: number
  userInitials: string
  userName: string
  userRole: string
}
function Sidebar({ activeIndex, userInitials, userName, userRole }: SidebarProps) {
  return (
    <g>
      <rect x={0} y={36} width={SIDEBAR_W} height={FRAME_HEIGHT - 36} fill={BF.sidebar} />
      {/* Wordmark */}
      <T x={20} y={64} fill="#ffffff" size={14} weight="600">Brightfield</T>
      {/* Nav items */}
      {NAV_ITEMS.map((item, i) => {
        const isActive = i === activeIndex
        const iy = 100 + i * 38
        return (
          <g key={item}>
            {isActive && <rect x={10} y={iy - 13} width={SIDEBAR_W - 20} height={26} rx={6} fill={BF.sidebarActiveRow} />}
            <T x={20} y={iy} fill={isActive ? '#ffffff' : BF.sidebarText} size={12} weight={isActive ? '500' : 'normal'}>{item}</T>
          </g>
        )
      })}
      {/* User block */}
      <circle cx={24} cy={FRAME_HEIGHT - 30} r={14} fill={BF.blueTint} />
      <T x={24} y={FRAME_HEIGHT - 30} anchor="middle" fill={BF.blue} size={10} weight="600">{userInitials}</T>
      <T x={44} y={FRAME_HEIGHT - 35} fill="#ffffff" size={11} weight="500">{userName}</T>
      <T x={44} y={FRAME_HEIGHT - 21} fill={BF.sidebarText} size={10}>{userRole}</T>
    </g>
  )
}

function TopBar({ title }: { title: string }) {
  return (
    <g>
      <rect x={CONTENT_X} y={36} width={CONTENT_W} height={36} fill={BF.panel} stroke={BF.hairline} strokeWidth={1} />
      <T x={CONTENT_X + 20} y={54} size={13} weight="600" fill={BF.text}>{title}</T>
      {/* Search field */}
      <rect x={CONTENT_X + CONTENT_W - 174} y={43} width={154} height={22} rx={5} fill={BF.shade} />
      <T x={CONTENT_X + CONTENT_W - 170} y={54} fill={BF.faint} size={10}>Search Brightfield…</T>
    </g>
  )
}

interface ModalProps { title: string; body: string; action: string }
function Modal({ title, body, action }: ModalProps) {
  const mx = CONTENT_X + CONTENT_W / 2 - 160
  const my = CONTENT_Y + 60
  return (
    <g>
      <rect x={CONTENT_X} y={36} width={CONTENT_W} height={FRAME_HEIGHT - 36} fill={BF.text} opacity={0.35} />
      <Panel x={mx} y={my} w={320} h={160} rx={12}>
        <T x={mx + 16} y={my + 28} size={14} weight="600">{title}</T>
        <T x={mx + 16} y={my + 56} size={11} fill={BF.muted}>{body.split(' — ')[0]}</T>
        {body.includes(' — ') && <T x={mx + 16} y={my + 70} size={11} fill={BF.muted}>{body.split(' — ')[1] ?? ''}</T>}
        <Btn x={mx + 192} y={my + 120} w={112} label={action} variant="accent" />
      </Panel>
    </g>
  )
}

function Toast({ label }: { label: string }) {
  const tx = CONTENT_X + CONTENT_W - 120
  const ty = FRAME_HEIGHT - 52
  return (
    <g>
      <rect x={tx} y={ty} width={100} height={28} rx={14} fill={BF.text} />
      <T x={tx + 50} y={ty + 14} anchor="middle" fill="#fff" size={11}>{label}</T>
    </g>
  )
}

function Tooltip({ x, y, label }: { x: number; y: number; label: string }) {
  const w = label.length * 6.5 + 16
  return (
    <g>
      <rect x={x} y={y} width={w} height={22} rx={5} fill={BF.text} />
      <polygon points={`${x + 10},${y} ${x + 17},${y - 6} ${x + 24},${y}`} fill={BF.text} />
      <T x={x + w / 2} y={y + 11} anchor="middle" fill="#fff" size={10}>{label}</T>
    </g>
  )
}

function CompassLauncher({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 18} y={y - 14} width={60} height={28} rx={14} fill={BF.accentSoft} />
      <CompassGlyph cx={x + 12} cy={y} r={10} />
      <T x={x - 10} y={y} size={10} fill={BF.accent} weight="500">Compass</T>
    </g>
  )
}

function Cursor({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g filter="drop-shadow(1px 2px 2px rgba(0,0,0,0.18))">
      <polygon
        points={`${cx},${cy} ${cx + 10},${cy + 14} ${cx + 4},${cy + 13} ${cx + 2},${cy + 20} ${cx - 1},${cy + 19} ${cx + 1},${cy + 12} ${cx - 4},${cy + 10}`}
        fill="#ffffff" stroke="#333" strokeWidth={0.8}
      />
    </g>
  )
}

// ─── Views ────────────────────────────────────────────────────────────────────

function ViewPortalHome() {
  const cx = CONTENT_X
  const cy = CONTENT_Y
  const cw = CONTENT_W - 32

  // Welcome strip
  const wx = cx + 16; const wy = cy + 14
  return (
    <g>
      {/* Welcome strip */}
      <rect x={wx} y={wy} width={cw} height={92} rx={10} fill={BF.panel} stroke={BF.hairline} strokeWidth={1} />
      <T x={wx + 20} y={wy + 28} size={18} weight="600" fill={BF.text}>Welcome to Brightfield</T>
      <T x={wx + 20} y={wy + 52} size={11} fill={BF.muted}>Your day one starts here — everything below is ready when you are.</T>

      {/* Three equal panels */}
      {(['Your first tasks', 'Meet the team', 'Where things live'] as const).map((title, i) => {
        const pw = (cw - 32) / 3
        const px = wx + i * (pw + 16)
        const py = wy + 108
        return (
          <Panel key={title} x={px} y={py} w={pw} h={112}>
            <T x={px + 14} y={py + 22} size={12} weight="600">{title}</T>
            <Bar x={px + 14} y={py + 46} w={pw * 0.75} />
            <Bar x={px + 14} y={py + 62} w={pw * 0.6} />
            <Bar x={px + 14} y={py + 78} w={pw * 0.45} />
          </Panel>
        )
      })}

      {/* Compass panel */}
      {(() => {
        const cpw = cw * 0.58; const cph = 122
        const cpx = wx; const cpy = wy + 238
        return (
          <g>
            <rect x={cpx} y={cpy} width={cpw} height={cph} rx={12} fill={BF.accentSoft} />
            <CompassGlyph cx={cpx + 28} cy={cpy + 38} r={16} />
            <T x={cpx + 54} y={cpy + 32} size={15} weight="600" fill={BF.accent}>Hi, I&apos;m Compass</T>
            <T x={cpx + 54} y={cpy + 52} size={11} fill={BF.text}>Ask me anything about getting started — laptop setup, leave,</T>
            <T x={cpx + 54} y={cpy + 66} size={11} fill={BF.text}>expenses, or who to talk to. I already know your role.</T>
            {/* Input */}
            <rect x={cpx + 14} y={cpy + 88} width={cpw - 28} height={24} rx={12} fill={BF.panel} stroke={BF.accent} strokeWidth={1} />
            <T x={cpx + 28} y={cpy + 100} fill={BF.faint} size={10}>Type a question…</T>
          </g>
        )
      })()}
    </g>
  )
}

interface ViewHrisRecordProps { scene: Scene }
function ViewHrisRecord({ scene }: ViewHrisRecordProps) {
  const cx = CONTENT_X + 16; const cy = CONTENT_Y + 14
  const name = scene.typedText || 'New starter'
  const isRestricted = scene.focusedField === 1
  const isBenefitsActive = scene.rowIndex === 1

  return (
    <g>
      {/* Left: Profile card */}
      <Panel x={cx} y={cy} w={252} h={220} rx={10}>
        <circle cx={cx + 126} cy={cy + 52} r={30} fill={BF.blueTint} />
        <T x={cx + 126} y={cy + 52} anchor="middle" fill={BF.blue} size={16} weight="600">{initials(name)}</T>
        <T x={cx + 126} y={cy + 98} anchor="middle" size={13} weight="600">{name}</T>
        <T x={cx + 126} y={cy + 116} anchor="middle" size={10} fill={BF.muted}>Employee record · Brightfield</T>
        <line x1={cx + 20} y1={cy + 132} x2={cx + 232} y2={cy + 132} stroke={BF.hairline} strokeWidth={1} />
        <T x={cx + 20} y={cy + 150} size={9} fill={BF.faint} mono>SECURITY TIER</T>
        <Chip x={cx + 20} y={cy + 175} label={isRestricted ? 'Restricted' : 'Standard'} />
      </Panel>

      {/* Right: Employment details */}
      <Panel x={cx + 268} y={cy} w={CONTENT_W - 284 - 32} h={220} rx={10}>
        {(() => {
          const rx2 = cx + 268; const ry = cy
          const rw  = CONTENT_W - 284 - 32
          const rows: [string, string][] = [
            ['Employment type', isRestricted ? 'Contract' : 'Full-time'],
            ['Team', 'Platform Engineering'],
            ['Manager', 'Jordan Ellis'],
            ['Start date', '—'],
            ['Benefits enrolment', isBenefitsActive ? 'Managed by agency — not applicable' : 'Enrolled after 30 days'],
          ]
          return (
            <>
              <T x={rx2 + 16} y={ry + 22} size={13} weight="600">Employment details</T>
              {rows.map(([label, value], i) => (
                <g key={label}>
                  {i > 0 && <line x1={rx2 + 16} y1={ry + 40 + i * 30} x2={rx2 + rw - 16} y2={ry + 40 + i * 30} stroke={BF.hairline} strokeWidth={1} />}
                  <T x={rx2 + 16} y={ry + 55 + i * 30} fill={BF.muted} size={10}>{label}</T>
                  <T x={rx2 + rw - 16} y={ry + 55 + i * 30} anchor="end" size={11}>{value}</T>
                </g>
              ))}
            </>
          )
        })()}
      </Panel>
    </g>
  )
}

interface ViewItsmTicketProps { scene: Scene }
function ViewItsmTicket({ scene }: ViewItsmTicketProps) {
  const cx = CONTENT_X + 16; const cy = CONTENT_Y + 14
  const typedName = scene.typedText || 'you'
  const tickets: [string, string, string][] = [
    ['IT-4471', 'New laptop provisioning — new starter', 'New'],
    ['IT-4409', 'VPN access — restricted queue',         'In progress'],
    ['IT-4390', 'Staging environment access request',   'Approved'],
  ]
  const activeIdx = Math.max(0, Math.min(scene.rowIndex >= 0 ? scene.rowIndex : 0, 2))
  const activeTicket = tickets[activeIdx]

  return (
    <g>
      {/* Ticket list */}
      <Panel x={cx} y={cy} w={CONTENT_W - 32} h={92} rx={10}>
        {tickets.map(([id, title, status], i) => {
          const ty2 = cy + 18 + i * 26
          const isActive = i === activeIdx
          return (
            <g key={id} opacity={isActive ? 1 : 0.45}>
              <T x={cx + 16} y={ty2} size={10} fill={BF.muted} mono>{id}</T>
              <T x={cx + 70} y={ty2} size={11} weight={isActive ? '600' : 'normal'}>{title}</T>
              <Chip x={cx + CONTENT_W - 120} y={ty2} label={status} />
            </g>
          )
        })}
      </Panel>

      {/* Detail panel */}
      {activeTicket && (
        <Panel x={cx} y={cy + 108} w={CONTENT_W - 32} h={320} rx={10}>
          <T x={cx + 16} y={cy + 136} size={13} weight="600">{activeTicket[1]}</T>
          <Chip x={cx + 16} y={cy + 160} label={activeTicket[2]} />
          <T x={cx + 100} y={cy + 160} size={10} fill={BF.muted} mono>{`Requested by ${typedName} · assigned to IT Support`}</T>
          <line x1={cx + 16} y1={cy + 178} x2={cx + CONTENT_W - 48} y2={cy + 178} stroke={BF.hairline} strokeWidth={1} />
          <T x={cx + 16} y={cy + 196} size={11} fill={BF.muted}>Compass opened this ticket from the details already on file — role, OS and</T>
          <T x={cx + 16} y={cy + 212} size={11} fill={BF.muted}>security tier — so nothing has to be typed twice.</T>
          <line x1={cx + 16} y1={cy + 230} x2={cx + CONTENT_W - 48} y2={cy + 230} stroke={BF.hairline} strokeWidth={1} />
          <T x={cx + 16} y={cy + 248} size={9} fill={BF.faint} mono>ACTIVITY</T>
          {/* Timeline */}
          <circle cx={cx + 24} cy={cy + 278} r={5} fill={BF.blue} />
          <T x={cx + 38} y={cy + 278} size={11}>Compass created this request and attached your device profile</T>
          <circle cx={cx + 24} cy={cy + 310} r={5} fill={activeTicket[2] === 'Approved' ? BF.green : BF.faint} />
          <T x={cx + 38} y={cy + 310} size={11}>
            {activeTicket[2] === 'Approved' ? 'IT Support approved the request' : 'Waiting on IT Support'}
          </T>
        </Panel>
      )}
    </g>
  )
}

interface ViewDocsArticleProps { scene: Scene }
function ViewDocsArticle({ scene }: ViewDocsArticleProps) {
  const cx = CONTENT_X + 16; const cy = CONTENT_Y + 14
  const isContractor = scene.rowIndex === 1

  return (
    <g>
      {/* Breadcrumb */}
      <T x={cx} y={cy} size={9} fill={BF.faint} mono>DOCS / POLICIES / TIME OFF</T>

      <Panel x={cx} y={cy + 14} w={CONTENT_W - 32} h={380} rx={10}>
        <T x={cx + 20} y={cy + 46} size={16} weight="600">Time off &amp; leave policy</T>
        <T x={cx + 20} y={cy + 66} size={10} fill={BF.faint} mono>Last reviewed · HR policy library</T>
        <line x1={cx + 20} y1={cy + 80} x2={cx + CONTENT_W - 52} y2={cy + 80} stroke={BF.hairline} strokeWidth={1} />

        {/* Policy body */}
        {[
          'Annual leave is accrued from your start date at a standard rate of 25 days per year.',
          'Leave requests must be submitted at least 5 working days in advance via Brightfield.',
          'Approval thresholds: up to 3 days, line manager only; 4–10 days, department head.',
          'Holiday carry-over is limited to 5 days and must be used by 31 March of the following year.',
          'Compassionate and emergency leave is approved by HR and does not reduce annual entitlement.',
        ].map((line, i) => (
          <T key={i} x={cx + 20} y={cy + 108 + i * 20} size={11} fill={BF.text}>{line}</T>
        ))}

        {/* Callout */}
        <rect x={cx + 20} y={cy + 300} width={CONTENT_W - 72} height={58} rx={8}
          fill={isContractor ? BF.amberTint : BF.blueTint} />
        <T x={cx + 36} y={cy + 321} size={11} weight="600"
          fill={isContractor ? BF.amber : BF.blue}>
          {isContractor ? 'Contractor note' : 'Key policy point'}
        </T>
        <T x={cx + 36} y={cy + 340} size={10} fill={isContractor ? BF.amber : BF.blue}>
          {isContractor
            ? 'Contractors are not entitled to paid annual leave — check your SOW for time-off terms.'
            : 'Leave taken outside an approved period may not be paid. Confirm dates with your manager.'}
        </T>
      </Panel>
    </g>
  )
}

interface ViewCommsThreadProps { scene: Scene }
function ViewCommsThread({ scene }: ViewCommsThreadProps) {
  const cx = CONTENT_X + 16; const cy = CONTENT_Y + 14
  const messages = [
    { from: 'AK', text: 'Hey, do you know how to book a day off?',         right: false },
    { from: 'MB', text: 'Same — I asked Compass and it walked me through it.', right: false },
    { from: 'C',  text: 'Leave requests go through Brightfield: go to Expenses → Time off, select the dates, and your manager will get an approval notification. Let me know if you hit any issues.', right: true },
  ]

  return (
    <g>
      <Panel x={cx} y={cy} w={CONTENT_W - 32} h={340} rx={10}>
        {messages.map((msg, i) => {
          const my2 = cy + 28 + i * 100
          if (msg.right) {
            return (
              <g key={i}>
                <CompassGlyph cx={cx + CONTENT_W - 68} cy={my2 + 14} r={12} />
                <rect x={cx + 16} y={my2} width={CONTENT_W - 100} height={70} rx={10} fill={BF.accentSoft} />
                <T x={cx + 28} y={my2 + 20} size={11}>{msg.text.slice(0, 70)}</T>
                {msg.text.length > 70 && <T x={cx + 28} y={my2 + 36} size={11}>{msg.text.slice(70, 140)}</T>}
                {msg.text.length > 140 && <T x={cx + 28} y={my2 + 52} size={11}>{msg.text.slice(140)}</T>}
              </g>
            )
          }
          return (
            <g key={i}>
              <circle cx={cx + 28} cy={my2 + 14} r={12} fill={BF.shade} />
              <T x={cx + 28} y={my2 + 14} anchor="middle" size={10} fill={BF.muted}>{msg.from}</T>
              <rect x={cx + 50} y={my2} width={300} height={34} rx={8} fill={BF.shade} />
              <T x={cx + 62} y={my2 + 17} size={11}>{msg.text}</T>
            </g>
          )
        })}
      </Panel>
      {/* Composer */}
      <rect x={cx} y={cy + 356} width={CONTENT_W - 32} height={32} rx={10}
        fill={BF.panel} stroke={BF.hairline} strokeWidth={1} />
      <T x={cx + 16} y={cy + 372} fill={BF.faint} size={10}>Message…</T>
      <_ scene={scene} />
    </g>
  )
}
// Dummy component to absorb unused scene prop
function _({ scene: _ }: { scene: Scene }) { return null }

interface ViewProjectBoardProps { scene: Scene }
function ViewProjectBoard({ scene }: ViewProjectBoardProps) {
  const cx = CONTENT_X + 16; const cy = CONTENT_Y + 14
  const cols  = ['To do', 'In progress', 'Needs sign-off'] as const
  const activeCol = Math.max(0, scene.rowIndex >= 0 ? scene.rowIndex : -1)
  const cardSets = [
    ['Onboarding checklist', 'Review team docs', 'Set up dev environment', 'First stand-up'],
    ['Laptop provisioning', 'VPN access setup', 'Slack channels joined'],
    ['Security training', 'IT policy sign-off', 'Benefits enrolment'],
  ]

  return (
    <g>
      {cols.map((col, ci) => {
        const colW = (CONTENT_W - 48) / 3
        const colX = cx + ci * (colW + 16)
        return (
          <g key={col}>
            <T x={colX + 8} y={cy + 12} size={11} weight="600" fill={BF.muted}>{col}</T>
            {(cardSets[ci] ?? []).map((card, ki) => {
              const ky = cy + 28 + ki * 62
              const isFocused = ci === activeCol
              return (
                <Panel key={card} x={colX} y={ky} w={colW} h={52} rx={8}>
                  <T x={colX + 10} y={ky + 18} size={11} weight={isFocused ? '600' : 'normal'}>{card}</T>
                  <Bar x={colX + 10} y={ky + 34} w={colW * 0.6} h={6} />
                  <circle cx={colX + colW - 16} cy={ky + 34} r={8} fill={BF.blueTint} />
                </Panel>
              )
            })}
          </g>
        )
      })}
    </g>
  )
}

interface ViewExpenseClaimProps { scene: Scene }
function ViewExpenseClaim({ scene }: ViewExpenseClaimProps) {
  const cx = CONTENT_X + 16; const cy = CONTENT_Y + 14
  const fi = scene.focusedField ?? -1
  const tv = scene.typedText ?? ''
  const fields: [string, string][] = [
    ['Description', fi === 0 ? tv : ''],
    ['Amount (£)',  fi === 1 ? tv : ''],
    ['Category',   fi === 2 ? tv : ''],
    ['Date',       fi === 3 ? tv : ''],
  ]
  const hw = CONTENT_W - 32

  return (
    <g>
      <Panel x={cx} y={cy} w={hw} h={340} rx={10}>
        <T x={cx + 20} y={cy + 26} size={14} weight="600">New expense claim</T>
        {fields.map(([label, value], i) => (
          <Field
            key={label}
            x={cx + 20 + (i % 2) * (hw / 2 - 24)}
            y={cy + 50 + Math.floor(i / 2) * 56}
            w={hw / 2 - 40}
            label={label}
            value={value}
            focused={fi === i}
          />
        ))}

        {/* Approval strip */}
        <rect x={cx + 20} y={cy + 240} width={hw - 40} height={44} rx={8} fill={BF.amberTint} />
        <T x={cx + 36} y={cy + 256} size={11} weight="600" fill={BF.amber}>Approval limit</T>
        <T x={cx + 36} y={cy + 272} size={10} fill={BF.amber}>Claims under £150 self-approve; anything above routes to your manager.</T>

        <Btn x={cx + hw - 130} y={cy + 298} w={100} label="Submit claim" variant="accent" />
      </Panel>
    </g>
  )
}

interface ViewQuizProps { scene: Scene }
function ViewQuiz({ scene }: ViewQuizProps) {
  const cx = CONTENT_X + CONTENT_W / 2; const cy = CONTENT_Y + 20
  const prompts = [
    'You get an email asking you to reset your password by clicking a link. What do you do?',
    'A colleague asks to borrow your access badge for five minutes. What do you do?',
    "You're not sure whether a document is safe to share outside the company. What do you do?",
  ]
  const fi = scene.focusedField ?? 0
  const prompt = prompts[Math.max(0, fi) % prompts.length] ?? prompts[0]!
  const options = [
    { text: 'Report it to IT Support',     correct: true },
    { text: 'Click the link to check',     correct: false },
    { text: 'Forward it to a teammate',    correct: false },
    { text: 'Ignore it',                   correct: false },
  ]
  const pickedIdx  = scene.rowIndex
  const revealed   = scene.overlay === 'toast'
  const panelW = 520; const panelH = 370
  const panelX = cx - panelW / 2; const panelY = cy + 52

  return (
    <g>
      <CompassGlyph cx={cx} cy={cy + 16} r={16} />
      <T x={cx} y={cy + 42} anchor="middle" size={9} fill={BF.accent} mono weight="500">COMPASS · TUTOR</T>

      <Panel x={panelX} y={panelY} w={panelW} h={panelH} rx={12}>
        {/* Prompt — wrapped across two lines */}
        <T x={panelX + 24} y={panelY + 36} size={12} weight="600">
          {prompt.length > 60 ? prompt.slice(0, 60) : prompt}
        </T>
        {prompt.length > 60 && (
          <T x={panelX + 24} y={panelY + 54} size={12} weight="600">
            {prompt.slice(60)}
          </T>
        )}

        {options.map((opt, i) => {
          const oy = panelY + 90 + i * 46
          const isPicked = i === pickedIdx
          let bg: string = BF.panel
          let border: string = BF.harderLine
          let textColor: string = BF.text
          if (isPicked) {
            if (revealed) {
              bg = opt.correct ? BF.greenTint : BF.redTint
              border = opt.correct ? BF.green : BF.red
              textColor = opt.correct ? BF.green : BF.red
            } else {
              bg = BF.accentSoft as string
              border = BF.accent as string
            }
          }
          return (
            <g key={i}>
              <rect x={panelX + 16} y={oy - 16} width={panelW - 32} height={38} rx={8}
                fill={bg} stroke={border} strokeWidth={1} />
              <circle cx={panelX + 36} cy={oy + 3} r={7} fill={isPicked ? border : 'none'} stroke={border} strokeWidth={1.5} />
              {isPicked && <circle cx={panelX + 36} cy={oy + 3} r={3} fill={BF.panel} />}
              <T x={panelX + 52} y={oy + 3} size={11} fill={textColor}>{opt.text}</T>
            </g>
          )
        })}

        {!revealed && (
          <Btn x={panelX + panelW - 100} y={panelY + panelH - 44} w={80} label="Submit" variant="accent" />
        )}
      </Panel>
    </g>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────

interface SoftwareFrameProps {
  scene: Scene
}

export function SoftwareFrame({ scene }: SoftwareFrameProps) {
  const meta = VIEW_META[scene.view] ?? VIEW_META['portal-home']!
  const isCompassView = scene.view === 'comms-thread' || scene.view === 'quiz'
  const tabTitle  = isCompassView ? 'Compass' : 'Brightfield Intranet'
  const typedName = scene.typedText || 'New starter'

  const viewTitle = meta.title

  function renderView() {
    switch (scene.view) {
      case 'portal-home':   return <ViewPortalHome />
      case 'hris-record':   return <ViewHrisRecord scene={scene} />
      case 'itsm-ticket':   return <ViewItsmTicket scene={scene} />
      case 'docs-article':  return <ViewDocsArticle scene={scene} />
      case 'comms-thread':  return <ViewCommsThread scene={scene} />
      case 'project-board': return <ViewProjectBoard scene={scene} />
      case 'expense-claim': return <ViewExpenseClaim scene={scene} />
      case 'quiz':          return <ViewQuiz scene={scene} />
      default:              return <ViewPortalHome />
    }
  }

  return (
    <svg
      viewBox={`0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={`Compass view: ${viewTitle}`}
      style={{ display: 'block' }}
    >
      {/* App background */}
      <rect width={FRAME_WIDTH} height={FRAME_HEIGHT} fill={BF.appBackground} />

      {/* Browser chrome */}
      <BrowserChrome tabTitle={tabTitle} path={meta.path} />

      {/* Sidebar */}
      <Sidebar
        activeIndex={scene.sidebarIndex}
        userInitials={initials(typedName)}
        userName={typedName}
        userRole="Team member"
      />

      {/* Top bar */}
      <TopBar title={viewTitle} />

      {/* Content area background */}
      <rect x={CONTENT_X} y={CONTENT_Y} width={CONTENT_W} height={FRAME_HEIGHT - CONTENT_Y} fill={BF.appBackground} />

      {/* View content */}
      {renderView()}

      {/* Compass launcher (not on quiz) */}
      {scene.view !== 'quiz' && (
        <CompassLauncher x={CONTENT_X + CONTENT_W - 48} y={FRAME_HEIGHT - 30} />
      )}

      {/* Overlays */}
      {scene.overlay === 'modal' && (
        <Modal
          title="Request submitted"
          body="Compass has sent this through — you'll get a confirmation once it's approved."
          action="Done"
        />
      )}
      {scene.overlay === 'toast' && scene.view !== 'quiz' && (
        <Toast label="Saved" />
      )}
      {scene.overlay === 'tooltip' && (
        <Tooltip
          x={CONTENT_X + 40}
          y={CONTENT_Y + 40}
          label="Scoped to your role"
        />
      )}
      {scene.cursor && (
        <Cursor cx={scene.cursor[0]} cy={scene.cursor[1]} />
      )}
    </svg>
  )
}

export default SoftwareFrame
