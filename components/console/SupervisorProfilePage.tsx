/**
 * components/console/SupervisorProfilePage.tsx
 * The supervisor's own profile tab.
 *
 * Holds no cohort figures (how many finished, who needs attention, average
 * score) — those are about the roster, not this person, and live on the
 * supervisor grid page instead.
 */
'use client'

import type { Profile } from '@/lib/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface SupervisorProfilePageProps {
  profile:       Profile
  /** Real email from the authenticated user. */
  email:         string
  /** Live count of interns assigned to this supervisor. */
  internCount:   number
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SupervisorProfilePage({ profile, email, internCount }: SupervisorProfilePageProps) {
  const { persona } = profile
  const company   = profile.systemsMeta.workspaceName || ''
  const noun = internCount === 1 ? 'new starter' : 'new starters'

  const recordRows: { label: string; value: string }[] = [
    { label: 'Name',       value: persona.name },
    { label: 'Role',       value: 'Supervisor' },
    { label: 'Company',    value: company },
    { label: 'Work email', value: email },
  ]

  return (
    <div
      className="thin-scroll"
      style={{
        flex: 1, overflowY: 'auto',
        background: 'var(--color-page)',
      }}
    >
      <div
        style={{
          maxWidth: 820, margin: '0 auto',
          padding: '36px 32px',
        }}
      >
        {/* 1 — Identity card (accent tint, not violet, for the supervisor) */}
        <div
          className="card"
          style={{
            display: 'flex', alignItems: 'center',
            gap: 20, padding: 28,
          }}
        >
          <div
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--color-accent-soft)',
              color: 'var(--color-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 600, flexShrink: 0,
            }}
          >
            {persona.initials}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-ink)' }}>
              {persona.name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 }}>
              Supervisor &middot; {company}
            </div>
          </div>
        </div>

        {/* 2 — Roster count tile */}
        <div
          style={{
            marginTop: 20,
            maxWidth: 260,
            borderRadius: 20,
            background: 'var(--color-violet-soft)',
            padding: 24,
            color: 'var(--color-violet)',
          }}
        >
          <span
            className="section-label"
            style={{ display: 'block', marginBottom: 6, opacity: 0.7, color: 'var(--color-violet)' }}
          >
            Onboarding
          </span>
          <span
            style={{
              fontSize: 24, fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {internCount} {noun}
          </span>
        </div>

        {/* 3 — Employee record */}
        <div
          className="card"
          style={{
            marginTop: 20, padding: 28,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: 32, rowGap: 24,
          }}
        >
          {recordRows.map(row => (
            <div key={row.label}>
              <span className="section-label">{row.label}</span>
              <div
                style={{
                  marginTop: 6, fontSize: 13, fontWeight: 500,
                  color: 'var(--color-ink)',
                }}
              >
                {row.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
