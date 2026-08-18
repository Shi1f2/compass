/**
 * components/console/ConsoleShell.tsx
 * Signed-in shell. Two modes per role: mentor/profile for new starters,
 * supervisor/profile for supervisors.
 * The role decides which tabs exist and which mode it opens on — not each tab
 * deciding at render time whether to hide itself.
 */
'use client'

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { LogOut, Sparkles } from 'lucide-react'
import type { Profile, Role, Topic } from '@/lib/types'
import { consoleReducer, initConsoleState } from '@/lib/consoleState'
import { Lockup } from '@/components/Wordmark'
import ProgressIndicator from './ProgressIndicator'
import AskBar from './AskBar'
import TopicDetail from './TopicDetail'
import ProfileView from './ProfileView'
import type { StripItem } from './ProgrammeStrip'
import SupervisorPage from './SupervisorPage'
import SupervisorProfilePage from './SupervisorProfilePage'
import ReportPanel, { type ExportConfig } from './ReportPanel'
import PdfPreview from '../pdf/PdfPreview'

// ─── Query matcher ────────────────────────────────────────────────────────────

// Good enough for a demo where whatever is typed should still land on a real,
// relevant answer. Lowercase, split on non-alphanumeric, drop words ≤2 chars,
// score each topic by how many of those words appear in its title/answer/detail/system.
function matchTopic(topics: Topic[], query: string): Topic {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 2)

  if (words.length === 0 || topics.length === 0) return topics[0]!

  let bestScore = -1
  let best      = topics[0]!

  for (const topic of topics) {
    const haystack = [topic.title, topic.answer, topic.detail, topic.system]
      .join(' ')
      .toLowerCase()
    const score = words.filter(w => haystack.includes(w)).length
    if (score > bestScore) {
      bestScore = score
      best      = topic
    }
  }
  return best
}

// ─── Mode type ────────────────────────────────────────────────────────────────

type Mode = 'mentor' | 'profile' | 'supervisor'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConsoleShellProps {
  profile:   Profile
  role:      Role
  company:   string
  onSignOut: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConsoleShell({
  profile, role, company, onSignOut,
}: ConsoleShellProps) {
  const isSupervisor = role === 'supervisor'

  const [state,    dispatch]    = useReducer(consoleReducer, profile, initConsoleState)
  const [mode,     setMode]     = useState<Mode>(isSupervisor ? 'supervisor' : 'mentor')
  const [query,    setQuery]    = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    kind:          'manager',
    illustrations: true,
    pageSize:      'A4',
  })

  const topics = state.profile.topics
  const persona = state.profile.persona
  const firstName = persona.name.split(' ')[0] ?? persona.name

  // ── Active topic ──────────────────────────────────────────────────────────

  const activeTopic: Topic | undefined = useMemo(() =>
    topics.find(t => t.id === state.selectedTopicId) ?? topics[0],
  [topics, state.selectedTopicId])

  // ── Ask handler ───────────────────────────────────────────────────────────

  const handleAsk = useCallback((q: string) => {
    const winner = matchTopic(topics, q)
    dispatch({ type: 'SELECT', list: 'topics', id: winner.id })
    setQuery(q)
    setMode('mentor')
  }, [topics])

  // ── Pick topic directly (from profile strip) ──────────────────────────────

  const handlePickTopic = useCallback((id: string) => {
    const topic = topics.find(t => t.id === id)
    if (!topic) return
    dispatch({ type: 'SELECT', list: 'topics', id })
    setQuery(topic.title)
    setMode('mentor')
  }, [topics, dispatch])

  // ── Report / print ────────────────────────────────────────────────────────

  const handleOpenReport = useCallback(() => setReportOpen(true),  [])
  const handleCloseReport = useCallback(() => setReportOpen(false), [])

  const handlePrint = useCallback(() => {
    setReportOpen(false)
    setPreviewOpen(true)
    setTimeout(() => window.print(), 400)
  }, [])

  const handleClosePreview = useCallback(() => setPreviewOpen(false), [])

  // ── Escape key ────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (previewOpen) { setPreviewOpen(false); return }
      if (reportOpen)  { setReportOpen(false);  return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [previewOpen, reportOpen])

  // ── Programme strip items ─────────────────────────────────────────────────

  const stripItems: StripItem[] = useMemo(() =>
    topics.map(t => ({ id: t.id, title: t.title, start: t.start, end: t.end })),
  [topics])

  // ── Nav tabs ──────────────────────────────────────────────────────────────

  const tabs: { id: Mode; label: string }[] = isSupervisor
    ? [
        { id: 'supervisor', label: 'Supervisor' },
        { id: 'profile',    label: persona.name },
      ]
    : [
        { id: 'mentor',  label: 'Mentor'      },
        { id: 'profile', label: persona.name  },
      ]

  // ── Nav pill ─────────────────────────────────────────────────────────────

  function NavPill({ tab }: { tab: typeof tabs[0] }) {
    const isActive = mode === tab.id
    return (
      <button
        type="button"
        onClick={() => setMode(tab.id)}
        style={{
          padding:      '8px 16px',
          borderRadius: 9999,
          border:       'none',
          cursor:       'pointer',
          fontSize:     13,
          fontWeight:   500,
          textTransform: 'capitalize',
          background:   isActive ? 'var(--color-accent-soft)' : 'transparent',
          color:        isActive ? 'var(--color-accent)'      : 'var(--color-ink-muted)',
          transition:   'background 150ms, color 150ms',
          fontFamily:   'var(--font-sans)',
          whiteSpace:   'nowrap',
        }}
        onMouseEnter={e => {
          if (!isActive) {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-sunk)'
            ;(e.currentTarget as HTMLButtonElement).style.color    = 'var(--color-ink)'
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color    = 'var(--color-ink-muted)'
          }
        }}
      >
        {tab.label}
      </button>
    )
  }

  // ── Mentor empty state ────────────────────────────────────────────────────

  function MentorEmpty() {
    return (
      <div
        style={{
          flex:           1,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '0 32px',
          gap:            16,
          maxWidth:       380,
          margin:         '0 auto',
          textAlign:      'center',
        }}
      >
        <div
          style={{
            width:          56,
            height:         56,
            borderRadius:   '50%',
            background:     'var(--color-violet-soft)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            color:          'var(--color-violet)',
          }}
        >
          <Sparkles size={22} strokeWidth={1.8} />
        </div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--color-ink)' }}>
          Ask Compass anything
        </h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--color-ink-muted)' }}>
          Type a question on the left — laptop setup, time off, expenses, access — and Compass answers it
          the way it would for {firstName}.
        </p>
      </div>
    )
  }

  // ── Body switch ───────────────────────────────────────────────────────────

  function Body() {
    if (mode === 'supervisor') {
      return <SupervisorPage name={persona.name} company={company || state.profile.systemsMeta.workspaceName} />
    }
    if (mode === 'profile' && isSupervisor) {
      return <SupervisorProfilePage profile={state.profile} />
    }
    if (mode === 'profile') {
      return (
        <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', height: '100%' }}>
          <ProfileView
            profile={state.profile}
            stripItems={stripItems}
            selectedId={state.selectedTopicId}
            onSelect={handlePickTopic}
            onAskMentor={isSupervisor ? undefined : handleAsk}
          />
        </div>
      )
    }
    // Mentor mode
    return (
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside
          style={{
            width:        320,
            flexShrink:   0,
            borderRight:  '1px solid var(--color-border)',
            background:   'var(--color-surface)',
            overflowY:    'auto',
          }}
        >
          <AskBar onAsk={handleAsk} />
        </aside>

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {query && activeTopic
            ? (
              <TopicDetail
                topic={activeTopic}
                query={query}
                dispatch={dispatch}
                onReport={handleOpenReport}
              />
            )
            : <MentorEmpty />
          }
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* App shell */}
      <div
        data-app-shell
        style={{
          display:        'flex',
          flexDirection:  'column',
          height:         '100vh',
          overflow:       'hidden',
          background:     'var(--color-page)',
        }}
      >
        {/* Header */}
        <header
          style={{
            display:             'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems:          'center',
            gap:                 24,
            borderBottom:        '1px solid var(--color-border)',
            background:          'var(--color-surface)',
            padding:             '12px 28px',
            flexShrink:          0,
          }}
        >
          {/* Left: lockup */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <Lockup size="small" layout="inline" />
          </div>

          {/* Centre: nav */}
          <nav
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        4,
            }}
          >
            {tabs.map(tab => <NavPill key={tab.id} tab={tab} />)}
          </nav>

          {/* Right: gamification + sign out
              Both cells are forced to their max-content width so the
              three-column grid always knows each side's true minimum width.
              The gamification bar allows itself to shrink to nothing, which
              would silently report a minimum of zero and let the navigation
              shift off-centre — forcing max-content restores it. */}
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'flex-end',
              gap:            12,
              width:          'max-content',
              marginLeft:     'auto',
            }}
          >
            {!isSupervisor && (
              <ProgressIndicator pct={state.profile.onboardingPct} />
            )}
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              style={{
                display:      'inline-flex',
                alignItems:   'center',
                gap:          6,
                padding:      '8px 16px',
                borderRadius: 9999,
                border:       '1px solid var(--color-border)',
                background:   'var(--color-surface)',
                cursor:       'pointer',
                fontSize:     12,
                color:        'var(--color-ink-muted)',
                fontFamily:   'var(--font-sans)',
                fontWeight:   400,
                whiteSpace:   'nowrap',
                flexShrink:   0,
              }}
            >
              <LogOut size={13} strokeWidth={1.8} />
              Sign out
            </button>
          </div>
        </header>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <Body />
        </div>
      </div>

      {/* Report panel */}
      {reportOpen && (
        <ReportPanel
          config={exportConfig}
          topicCount={topics.length}
          questionCount={state.profile.quiz.length}
          onConfig={setExportConfig}
          onPreview={handleCloseReport}
          onPrint={handlePrint}
          onClose={handleCloseReport}
        />
      )}

      {/* PDF preview */}
      {previewOpen && (
        <PdfPreview
          profile={state.profile}
          config={exportConfig}
          onClose={handleClosePreview}
        />
      )}
    </>
  )
}
