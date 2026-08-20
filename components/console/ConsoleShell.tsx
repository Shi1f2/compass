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
import InternTasks from './InternTasks'
import type { Starter } from '@/lib/supervisorData'
import type { AnswerStep } from '@/lib/guideTypes'
import { consoleReducer, initConsoleState } from '@/lib/consoleState'
import { Lockup } from '@/components/Wordmark'
import AskBar from './AskBar'
import TopicDetail from './TopicDetail'
import GuideAnswer from './GuideAnswer'
import ProfileView from './ProfileView'
import type { StripItem } from './ProgrammeStrip'
import SupervisorPage from './SupervisorPage'
import SupervisorProfilePage from './SupervisorProfilePage'
import ReportPanel, { type ExportConfig } from './ReportPanel'
import PdfPreview from '../pdf/PdfPreview'
import InternQuizView from './InternQuizView'

// ─── Mode type ────────────────────────────────────────────────────────────────

type Mode = 'mentor' | 'profile' | 'supervisor' | 'tasks' | 'quizzes'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConsoleShellProps {
  profile:    Profile
  role:       Role
  company:    string
  onSignOut:  () => void
  /** Supervisor only: real roster from the DB. */
  roster?:    Starter[]
  /** Supervisor only: server action to send an invite. */
  onInvite?:  (email: string, jobRoleId: string) => Promise<string | null>
  /** Supervisor only: the authenticated user's real email. */
  email?:     string
  /** Supervisor only: live count of interns under this supervisor. */
  internCount?: number
  /** Supervisor only: org UUID — required to scope the quiz library. */
  orgId?:       string
  /** When true, illustrative sample content is active. Shows a badge in the header. */
  demoContent?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConsoleShell({
  profile, role, company, onSignOut, roster = [], onInvite, email = '', internCount = 0,
  orgId = '', demoContent = false,
}: ConsoleShellProps) {
  const isSupervisor = role === 'supervisor'

  const [state,    dispatch]    = useReducer(consoleReducer, profile, initConsoleState)
  const [mode,     setMode]     = useState<Mode>(isSupervisor ? 'supervisor' : 'mentor')
  const [query,    setQuery]    = useState('')
  const [asking,   setAsking]   = useState(false)
  const [askError, setAskError] = useState<string | null>(null)
  const [steps,    setSteps]    = useState<AnswerStep[] | null>(null)
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

  const handleAsk = useCallback(async (q: string) => {
    // A live "Ask Compass" answer is rendered on its own — it is NOT forced into
    // a pre-authored topic, so no day/system/step chrome leaks in.
    setQuery(q)
    setMode('mentor')
    setAskError(null)
    setSteps(null)
    setAsking(true)
    try {
      const res = await fetch('/api/ask', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: q, persona }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`)
      setSteps(Array.isArray(data.steps) ? data.steps : [])
    } catch (err) {
      setAskError(err instanceof Error ? err.message : 'Something went wrong asking Compass.')
    } finally {
      setAsking(false)
    }
  }, [persona])

  // ── Pick topic directly (from profile strip) ──────────────────────────────

  const handlePickTopic = useCallback((id: string) => {
    const topic = topics.find(t => t.id === id)
    if (!topic) return
    dispatch({ type: 'SELECT', list: 'topics', id })
    setQuery(topic.title)
    setSteps(null)   // show the pre-authored topic, not a live answer
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
        { id: 'tasks',   label: 'Tasks'       },
        { id: 'quizzes', label: 'Quizzes'     },
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

  // ── Mentor loading state ──────────────────────────────────────────────────

  function AskLoading({ query }: { query: string }) {
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
          maxWidth:       420,
          margin:         '0 auto',
          textAlign:      'center',
        }}
      >
        <Sparkles
          size={26}
          strokeWidth={1.8}
          color="var(--color-violet)"
          style={{ animation: 'pulse 1.2s ease-in-out infinite' }}
        />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>
          Compass is thinking…
        </p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-ink-muted)' }}>
          “{query}”
        </p>
        <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }`}</style>
      </div>
    )
  }

  // ── Mentor error state ────────────────────────────────────────────────────

  function AskError({ query, message }: { query: string; message: string }) {
    return (
      <div
        style={{
          flex:           1,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '0 32px',
          gap:            12,
          maxWidth:       440,
          margin:         '0 auto',
          textAlign:      'center',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--color-ink)' }}>
          Couldn&rsquo;t reach Compass
        </h2>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-ink-muted)' }}>
          {message}
        </p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => handleAsk(query)}
          style={{ marginTop: 4 }}
        >
          Try again
        </button>
      </div>
    )
  }

  // ── Body switch ───────────────────────────────────────────────────────────

  function Body() {
    if (mode === 'tasks') {
      return <InternTasks />
    }
    if (mode === 'quizzes' && !isSupervisor) {
      return (
        <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <InternQuizView />
        </div>
      )
    }
    if (mode === 'supervisor') {
      return (
        <SupervisorPage
          name={persona.name}
          company={company || state.profile.systemsMeta.workspaceName}
          orgId={orgId}
          roster={roster}
          onInvite={onInvite ?? (async () => null)}
        />
      )
    }
    if (mode === 'profile' && isSupervisor) {
      return <SupervisorProfilePage profile={state.profile} email={email} internCount={internCount} />
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
          {!query
            ? <MentorEmpty />
            : asking
              ? <AskLoading query={query} />
              : askError
                ? <AskError query={query} message={askError} />
                : steps !== null
                  ? (
                    <GuideAnswer
                      query={query}
                      steps={steps}
                      onReport={handleOpenReport}
                      onAskAgain={() => handleAsk(query)}
                    />
                  )
                  : activeTopic
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
            {demoContent && (
              <span
                style={{
                  fontSize:     11,
                  fontWeight:   500,
                  padding:      '4px 10px',
                  borderRadius: 9999,
                  background:   'var(--color-yellow-soft)',
                  color:        'var(--color-waiting)',
                  whiteSpace:   'nowrap',
                  flexShrink:   0,
                }}
              >
                Sample content
              </span>
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
