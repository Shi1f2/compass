/**
 * components/console/ProfileView.tsx
 * Read-only "who you are" page: persona details, programme timeline,
 * progress and connected systems. Scrolling is owned by the caller.
 */
'use client'

import type { Profile } from '@/lib/types'
import type { StripItem } from './ProgrammeStrip'
import ProgrammeStrip from './ProgrammeStrip'
import OnboardingProgramme from './OnboardingProgramme'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProfileViewProps {
  profile:       Profile
  stripItems:    StripItem[]
  selectedId:    string
  onSelect:      (id: string) => void
  /** New starters only: called when "Ask mentor" or "Open in Mentor" is clicked */
  onAskMentor?:  (query: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfileView({
  profile, stripItems, selectedId, onSelect, onAskMentor,
}: ProfileViewProps) {
  const { persona, specRows, connectedSystems } = profile

  // Spec rows minus the first (Name) since it is shown in the identity card
  const detailRows = specRows.slice(1)

  return (
    <div
      style={{
        maxWidth: 1100,
        margin:   '0 auto',
        padding:  '36px 24px',
      }}
    >
      {/* 1 — Identity */}
      <div
        className="card"
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        20,
          padding:    28,
        }}
      >
        <div
          style={{
            width:          64,
            height:         64,
            borderRadius:   '50%',
            background:     'var(--color-violet-soft)',
            color:          'var(--color-violet)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       18,
            fontWeight:     600,
            flexShrink:     0,
          }}
        >
          {persona.initials}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-ink)' }}>
            {persona.name}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 }}>
            {persona.role === 'supervisor' ? 'Supervisor' : 'New starter'}
            &nbsp;&middot;&nbsp;
            {persona.team}
          </div>
        </div>
      </div>

      {/* 2 — Details */}
      <div
        className="card"
        style={{
          marginTop:           20,
          padding:             28,
          display:             'grid',
          gridTemplateColumns: '1fr 1fr',
          columnGap:           32,
          rowGap:              24,
        }}
      >
        {/* Spec rows (skip Name) */}
        {detailRows.map(row => (
          <div key={row.label}>
            <span className="section-label">{row.label}</span>
            <div style={{ marginTop: 6, fontSize: 13, fontWeight: 500, color: 'var(--color-ink)' }}>
              {row.value}
            </div>
          </div>
        ))}
        {/* OS */}
        <div>
          <span className="section-label">Operating system</span>
          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 500, color: 'var(--color-ink)' }}>
            {persona.os}
          </div>
        </div>
        {/* Location */}
        <div>
          <span className="section-label">Location</span>
          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 500, color: 'var(--color-ink)' }}>
            {persona.location}
          </div>
        </div>
      </div>

      {/* 3 — Programme strip (supervisor only / legacy — shown when no onAskMentor prop) */}
      {!onAskMentor && (
        <ProgrammeStrip
          items={stripItems}
          totalDays={profile.programmeDays}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      )}

      {/* 4 — Onboarding programme (new starter) */}
      {onAskMentor && (
        <div style={{ marginTop: 20 }}>
          <OnboardingProgramme onAskMentor={onAskMentor} />
        </div>
      )}

      {/* 5 — Connected systems */}
      <div className="card" style={{ marginTop: 20, padding: 28 }}>
        <span className="section-label" style={{ display: 'block', marginBottom: 14 }}>
          Connected systems
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {connectedSystems.map(sys => (
            <span
              key={sys}
              className="pill"
              style={{
                background:    'var(--color-sunk)',
                color:         'var(--color-ink-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {sys}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
