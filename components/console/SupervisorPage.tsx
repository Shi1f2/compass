/**
 * components/console/SupervisorPage.tsx
 * Supervisor landing page — roster grid, invite flow, per-person detail.
 */
'use client'

import React, {
  useCallback, useEffect, useRef, useState,
} from 'react'
import {
  ArrowLeft, Check, GraduationCap,
  Pencil, Plus, Search, Trash2, X,
} from 'lucide-react'
import {
  PASS_THRESHOLD,
  answeredCount, averageScore,
  taskPct, knowledgePct,
  type Starter,
} from '@/lib/supervisorData'
import { createClient } from '@/lib/supabase/client'
import type { JobRole, TaskTemplate } from '@/lib/database.types'
import {
  createJobRole,
  renameJobRole,
  deleteJobRole,
  countProfilesForRole,
  createTaskTemplate,
  renameTaskTemplate,
  deleteTaskTemplate,
} from '@/lib/settings-actions'
import InternTasksView from './InternTasksView'
import AssignmentPanel from './AssignmentPanel'

// ─── Constants ────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─── Avatar ───────────────────────────────────────────────────────────────────

const TINTS = [
  { bg: 'var(--color-violet-soft)', text: 'var(--color-violet)'  },
  { bg: 'var(--color-accent-soft)', text: 'var(--color-accent)'  },
  { bg: 'var(--color-yellow-soft)', text: 'var(--color-waiting)' },
  { bg: 'var(--color-correct-soft)',text: 'var(--color-correct)' },
]

/**
 * Initials on a soft tint rather than a black disc, so a roster reads as a
 * set of people and not a column of identical chips.
 */
export function Avatar({ initials, size = 44 }: { initials: string; size?: number }) {
  const code  = initials.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  const tint  = TINTS[code % TINTS.length]!
  const fsize = Math.round(size * 0.34)
  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: tint.bg, color: tint.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: fsize, fontWeight: 600, flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  )
}

// ─── Score label ──────────────────────────────────────────────────────────────

export function ScoreLabel({ score }: { score: number | null }) {
  if (score === null) {
    return <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)' }}>—</span>
  }
  const pass = score >= PASS_THRESHOLD
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      color: pass ? 'var(--color-correct)' : 'var(--color-incorrect)',
    }}>
      {score}%
    </span>
  )
}

// ─── Labelled bar ─────────────────────────────────────────────────────────────

/**
 * Used twice per card so the two dimensions read as visually equal, rather
 * than one being the real bar and the other an afterthought.
 */
function LabelledBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 68, fontSize: 11, color: 'var(--color-ink-muted)', flexShrink: 0 }}>{label}</span>
      <div className="track" style={{ flex: 1, height: 8 }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 9999, background: color }} />
      </div>
      <span style={{
        width: 36, textAlign: 'right', fontSize: 11, fontWeight: 500,
        fontVariantNumeric: 'tabular-nums', color: 'var(--color-ink-muted)',
      }}>{pct}%</span>
    </div>
  )
}

// ─── Knowledge toggle ─────────────────────────────────────────────────────────

function KnowledgeToggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      title={on ? 'Has a quiz question' : 'No quiz question'}
      aria-pressed={on}
      onClick={e => { e.stopPropagation(); onChange() }}
      style={{
        width: 32, height: 32, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', cursor: 'pointer', flexShrink: 0,
        background: on ? 'var(--color-violet-soft)' : 'var(--color-sunk)',
        color:      on ? 'var(--color-violet)'       : 'var(--color-locked)',
      }}
    >
      <GraduationCap size={14} />
    </button>
  )
}

// ─── Invite dialog ────────────────────────────────────────────────────────────
//
// Two views rendered inside the same fixed overlay:
//   'invite'      — email + role pills + optional details + footer
//   'role-editor' — create a new role or edit an existing one in-place

interface InviteDialogProps {
  onClose: () => void
  onSent:  (email: string, jobRoleId: string) => void
}

// ── Tiny reusable task-item row used inside the role editor ───────────────────

interface TaskItemRowProps {
  value:    string
  index:    number
  total:    number
  onChange: (v: string) => void
  onRemove: () => void
  onMove:   (dir: -1 | 1) => void
}

function TaskItemRow({ value, index, total, onChange, onRemove, onMove }: TaskItemRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label="Move up"
          style={{
            background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer',
            padding: '1px 3px', lineHeight: 1, fontSize: 10, color: 'var(--color-ink-muted)',
            opacity: index === 0 ? 0.25 : 1, fontFamily: 'var(--font-sans)',
          }}
        >▲</button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          aria-label="Move down"
          style={{
            background: 'none', border: 'none', cursor: index === total - 1 ? 'default' : 'pointer',
            padding: '1px 3px', lineHeight: 1, fontSize: 10, color: 'var(--color-ink-muted)',
            opacity: index === total - 1 ? 0.25 : 1, fontFamily: 'var(--font-sans)',
          }}
        >▼</button>
      </div>
      <input
        type="text"
        className="field"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Task title"
        style={{ flex: 1, fontSize: 13 }}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove task"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 4, color: 'var(--color-ink-muted)', display: 'flex', flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ── Role editor (create or edit) ──────────────────────────────────────────────

interface DraftItem { key: string; title: string }

interface RoleEditorProps {
  /** Null = create new role; non-null = edit existing */
  role:         JobRole | null
  orgId:        string
  onSaved:      (role: JobRole) => void
  onBack:       () => void
  onRoleDeleted: (roleId: string) => void
}

function RoleEditor({ role, orgId, onSaved, onBack, onRoleDeleted }: RoleEditorProps) {
  const supabase = createClient()
  const isNew = role === null

  const [roleName,   setRoleName]   = useState(role?.name ?? '')
  const [items,      setItems]      = useState<DraftItem[]>([])
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  // For edit mode: track the live templates so we can diff against drafts
  const [origTemplates, setOrigTemplates] = useState<TaskTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(!isNew)

  // Delete-role confirmation state
  const [deleteConfirm, setDeleteConfirm]     = useState(false)
  const [affectedCount, setAffectedCount]     = useState(0)
  const [loadingDelete, setLoadingDelete]     = useState(false)

  const nameRef = useRef<HTMLInputElement>(null)

  // Focus name field on open
  useEffect(() => { nameRef.current?.focus() }, [])

  // Load existing templates when editing
  useEffect(() => {
    if (isNew || !role) return
    let active = true
    ;(supabase
      .from('task_templates')
      .select('*')
      .eq('job_role_id', role.id)
      .eq('org_id', orgId)
      .order('order_index', { ascending: true }) as unknown as Promise<{ data: TaskTemplate[] | null }>)
      .then(({ data }) => {
        if (!active) return
        const templates = data ?? []
        setOrigTemplates(templates)
        setItems(templates.map(t => ({ key: t.id, title: t.title })))
        setLoadingTemplates(false)
      })
    return () => { active = false }
  }, [isNew, role, orgId, supabase])

  function addItem() {
    setItems(prev => [...prev, { key: `new-${Date.now()}`, title: '' }])
  }

  function updateItem(index: number, title: string) {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, title } : it))
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function moveItem(index: number, dir: -1 | 1) {
    const next = [...items]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap]!, next[index]!]
    setItems(next)
  }

  async function handleSave() {
    const name = roleName.trim()
    if (!name) { setError('Role name is required.'); return }
    setSaving(true)
    setError('')

    const validItems = items.filter(it => it.title.trim())

    if (isNew) {
      // ── Create role ──────────────────────────────────────────────────────────
      const { error: roleErr } = await createJobRole(name)
      if (roleErr) { setError(roleErr); setSaving(false); return }

      // Fetch the row we just created so we have its id
      const { data: rows } = await supabase
        .from('job_roles')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1) as unknown as { data: JobRole[] | null }
      const newRole = rows?.[0]
      if (!newRole) { setError('Role created but could not reload it.'); setSaving(false); return }

      // Create task templates
      for (let i = 0; i < validItems.length; i++) {
        const { error: tmplErr } = await createTaskTemplate(newRole.id, validItems[i]!.title.trim(), i)
        if (tmplErr) { setError(tmplErr); setSaving(false); return }
      }
      setSaving(false)
      onSaved(newRole)
    } else {
      // ── Edit existing role ────────────────────────────────────────────────────
      if (name !== role!.name) {
        const { error: renameErr } = await renameJobRole(role!.id, name)
        if (renameErr) { setError(renameErr); setSaving(false); return }
      }

      // Diff templates: delete removed, rename changed, add new
      const origIds = new Set(origTemplates.map(t => t.id))
      const draftIds = new Set(items.filter(it => origIds.has(it.key)).map(it => it.key))

      // Delete templates no longer in the list
      for (const orig of origTemplates) {
        if (!draftIds.has(orig.id)) {
          const { error: delErr } = await deleteTaskTemplate(orig.id)
          if (delErr) { setError(delErr); setSaving(false); return }
        }
      }

      // Rename changed templates
      for (const item of items) {
        if (!origIds.has(item.key)) continue
        const orig = origTemplates.find(t => t.id === item.key)
        if (orig && orig.title !== item.title.trim() && item.title.trim()) {
          const { error: renErr } = await renameTaskTemplate(item.key, item.title.trim())
          if (renErr) { setError(renErr); setSaving(false); return }
        }
      }

      // Add newly created items (keys starting with 'new-')
      const newItems = items.filter(it => !origIds.has(it.key) && it.title.trim())
      for (let i = 0; i < newItems.length; i++) {
        const orderIndex = origTemplates.length + i
        const { error: addErr } = await createTaskTemplate(role!.id, newItems[i]!.title.trim(), orderIndex)
        if (addErr) { setError(addErr); setSaving(false); return }
      }

      setSaving(false)
      onSaved({ ...role!, name })
    }
  }

  async function requestDelete() {
    if (!role) return
    setLoadingDelete(true)
    const { count, error: cErr } = await countProfilesForRole(role.id)
    if (cErr) { setError(cErr); setLoadingDelete(false); return }
    setAffectedCount(count)
    setLoadingDelete(false)
    setDeleteConfirm(true)
  }

  async function confirmDelete() {
    if (!role) return
    const { error: delErr } = await deleteJobRole(role.id)
    if (delErr) { setError(delErr); setDeleteConfirm(false); return }
    onRoleDeleted(role.id)
  }

  if (deleteConfirm && role) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <button
          type="button"
          onClick={() => setDeleteConfirm(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 13, color: 'var(--color-ink-muted)',
            fontFamily: 'var(--font-sans)', padding: 0, alignSelf: 'flex-start',
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>

        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          Delete &ldquo;{role.name}&rdquo;?
        </h3>

        {affectedCount > 0 ? (
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-ink-muted)' }}>
            <strong style={{ color: 'var(--color-ink)' }}>
              {affectedCount} {affectedCount === 1 ? 'person' : 'people'}
            </strong>{' '}
            {affectedCount === 1 ? 'is' : 'are'} currently assigned this role.
            Their existing tasks will not be deleted, but their role label will be cleared.
            The role&rsquo;s task templates will be removed.
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-ink-muted)' }}>
            This will delete the role and all its task templates.
            Tasks already assigned to people will not be affected.
          </p>
        )}

        {error && <p style={{ margin: 0, fontSize: 12, color: 'var(--color-incorrect)' }}>{error}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button type="button" className="btn-secondary" onClick={() => setDeleteConfirm(false)}>Cancel</button>
          <button
            type="button"
            onClick={confirmDelete}
            style={{
              padding: '10px 0', borderRadius: 9999, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
              background: 'var(--color-incorrect)', color: '#fff',
            }}
          >
            Delete role
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 13, color: 'var(--color-ink-muted)',
            fontFamily: 'var(--font-sans)', padding: 0,
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>
        {!isNew && (
          <button
            type="button"
            onClick={requestDelete}
            disabled={loadingDelete}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 12, color: 'var(--color-incorrect)',
              fontFamily: 'var(--font-sans)', padding: '4px 8px',
              opacity: loadingDelete ? 0.5 : 1,
            }}
          >
            <Trash2 size={13} /> Delete role
          </button>
        )}
      </div>

      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
        {isNew ? 'Create a role' : `Edit "${role!.name}"`}
      </h2>

      {/* Role name */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        Role name
        <input
          ref={nameRef}
          type="text"
          className="field"
          value={roleName}
          onChange={e => { setRoleName(e.target.value); setError('') }}
          placeholder="e.g. Graduate Analyst"
        />
      </label>

      {/* Task checklist */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
          Default tasks
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-ink-muted)', marginLeft: 6 }}>
            copied to each new starter with this role
          </span>
        </div>

        {loadingTemplates ? (
          <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', margin: 0 }}>Loading…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item, i) => (
              <TaskItemRow
                key={item.key}
                value={item.title}
                index={i}
                total={items.length}
                onChange={v => updateItem(i, v)}
                onRemove={() => removeItem(i)}
                onMove={dir => moveItem(i, dir)}
              />
            ))}
            <button
              type="button"
              onClick={addItem}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'none', border: '1px dashed var(--color-border)',
                borderRadius: 9999, cursor: 'pointer',
                fontSize: 12, color: 'var(--color-ink-muted)',
                padding: '6px 14px', fontFamily: 'var(--font-sans)',
                alignSelf: 'flex-start',
              }}
            >
              <Plus size={12} /> Add task
            </button>
          </div>
        )}
      </div>

      {error && <p style={{ margin: 0, fontSize: 12, color: 'var(--color-incorrect)' }}>{error}</p>}

      {/* Footer */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <button type="button" className="btn-secondary" onClick={onBack} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : isNew ? 'Create role' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// ── Main InviteDialog ─────────────────────────────────────────────────────────

function InviteDialog({ onClose, onSent }: InviteDialogProps) {
  const supabase = createClient()

  // ── Invite-view state ──────────────────────────────────────────────────────
  const [email,        setEmail]       = useState('')
  const [jobRoleId,    setJobRoleId]   = useState<string | null>(null)
  const [roles,        setRoles]       = useState<JobRole[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [error,        setError]       = useState('')
  const emailRef = useRef<HTMLInputElement>(null)

  // ── Role-editor state ──────────────────────────────────────────────────────
  // null = invite view; { role: null } = create new; { role: JobRole } = edit
  const [editorTarget, setEditorTarget] = useState<{ role: JobRole | null } | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)

  // Escape closes the dialog (not just the editor) when in invite view
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editorTarget) setEditorTarget(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose, editorTarget])

  // Focus email on mount
  useEffect(() => { emailRef.current?.focus() }, [])

  // Load org id + roles
  const loadRoles = useCallback(async (currentOrgId: string) => {
    const { data: rows } = await supabase
      .from('job_roles')
      .select('*')
      .eq('org_id', currentOrgId)
      .order('created_at', { ascending: true })
    setRoles(rows ?? [])
    setRolesLoading(false)
  }, [supabase])

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) { setRolesLoading(false); return }
      const id = data.user.app_metadata?.org_id as string | undefined
      if (!id) { setRolesLoading(false); return }
      setOrgId(id)
      loadRoles(id)
    })
    return () => { active = false }
  }, [supabase, loadRoles])

  function handleSend() {
    if (!EMAIL_RE.test(email)) { setError('Enter a valid email address.'); return }
    if (!jobRoleId)             { setError('Select a role before sending.'); return }
    onSent(email, jobRoleId)
  }

  function handleRoleSaved(newRole: JobRole) {
    setEditorTarget(null)
    // Refresh roles then auto-select the saved role
    if (orgId) {
      loadRoles(orgId).then(() => setJobRoleId(newRole.id))
    }
  }

  function handleRoleDeleted(roleId: string) {
    setEditorTarget(null)
    setRoles(prev => prev.filter(r => r.id !== roleId))
    if (jobRoleId === roleId) setJobRoleId(null)
  }

  const inEditor = editorTarget !== null
  const effectiveOrgId = orgId ?? ''

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
    >
      {/* Scrim — only closes when in invite view */}
      <div
        onClick={inEditor ? undefined : onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'color-mix(in srgb, var(--color-ink) 25%, transparent)',
          cursor: inEditor ? 'default' : 'pointer',
        }}
      />

      {/* Dialog card */}
      <div
        className="animate-fade-up thin-scroll"
        style={{
          position: 'relative', zIndex: 1,
          maxWidth: 480, width: '90vw',
          maxHeight: '90vh', overflowY: 'auto',
          borderRadius: 24, background: 'var(--color-surface)',
          padding: 32, boxShadow: 'var(--shadow-float)',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        {/* ── Role editor view ── */}
        {inEditor && (
          <RoleEditor
            role={editorTarget.role}
            orgId={effectiveOrgId}
            onSaved={handleRoleSaved}
            onBack={() => setEditorTarget(null)}
            onRoleDeleted={handleRoleDeleted}
          />
        )}

        {/* ── Invite view ── */}
        {!inEditor && (
          <>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Invite a new starter</h2>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-ink-muted)' }}>
              They&rsquo;ll receive an email with instructions to sign in.
              Their onboarding tasks are set up automatically from the role you choose.
            </p>

            {/* Email */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              Email
              <input
                ref={emailRef}
                type="email"
                className="field"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="jamie.rivera@yourcompany.com"
              />
            </label>

            {/* Role pills */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Role</div>
              {rolesLoading ? (
                <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', margin: 0 }}>Loading…</p>
              ) : (
                <>
                  {roles.length === 0 && (
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>
                      No roles yet — create the first one with the&nbsp;
                      <strong style={{ color: 'var(--color-ink)' }}>+</strong> button.
                    </p>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {roles.map(r => (
                      <div key={r.id} style={{ position: 'relative', display: 'inline-flex' }}>
                        <button
                          type="button"
                          onClick={() => { setJobRoleId(r.id); setError('') }}
                          style={{
                            paddingLeft: 16, paddingRight: 36,
                            paddingTop: 8, paddingBottom: 8,
                            borderRadius: 9999, border: 'none',
                            cursor: 'pointer', fontSize: 13, fontWeight: 500,
                            background: jobRoleId === r.id ? 'var(--color-violet)' : 'var(--color-sunk)',
                            color:      jobRoleId === r.id ? '#fff' : 'var(--color-ink-muted)',
                            transition: 'background 150ms, color 150ms',
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          {r.name}
                        </button>
                        {/* Edit affordance — sits inside the pill on the right */}
                        <button
                          type="button"
                          onClick={() => setEditorTarget({ role: r })}
                          aria-label={`Edit ${r.name}`}
                          style={{
                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                            display: 'flex', alignItems: 'center',
                            color: jobRoleId === r.id ? 'rgba(255,255,255,0.7)' : 'var(--color-ink-muted)',
                          }}
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                    ))}
                    {/* + pill — always last */}
                    <button
                      type="button"
                      onClick={() => setEditorTarget({ role: null })}
                      aria-label="Create new role"
                      style={{
                        padding: '8px 14px', borderRadius: 9999, border: '1px dashed var(--color-border)',
                        cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        background: 'transparent', color: 'var(--color-ink-muted)',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>

            {error && (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-incorrect)' }}>{error}</p>
            )}

            {/* Footer */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                disabled={!jobRoleId}
                onClick={handleSend}
              >
                Send invite
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Starter card ─────────────────────────────────────────────────────────────

function StarterCard({ starter, onClick }: { starter: Starter; onClick: () => void }) {
  const avg   = averageScore(starter)
  const tasks = taskPct(starter)
  const know  = knowledgePct(starter)
  const ans   = answeredCount(starter)
  const totalQ = starter.quiz.length

  return (
    <button
      type="button"
      className="card-btn"
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column',
        padding: 24, gap: 0, width: '100%',
      }}
    >
      {/* Person */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Avatar initials={starter.initials} size={40} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {starter.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {starter.jobTitle ?? 'Not set'} &middot; {starter.team ?? 'Not set'}
          </div>
        </div>
      </div>

      {/* Bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <LabelledBar label="Tasks"     pct={tasks} color="var(--color-accent)" />
        <LabelledBar label="Knowledge" pct={know}  color="var(--color-violet)" />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
        <span style={{ fontSize: 11, color: 'var(--color-ink-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {starter.taskDone}/{starter.taskTotal} tasks &middot; {ans}/{totalQ} Qs
        </span>
        <ScoreLabel score={avg} />
      </div>
    </button>
  )
}

// ─── Header stat tile ─────────────────────────────────────────────────────────
// (DeadlineLabel, ProgrammeBar and ChecklistTab removed — progress is computed
//  from real task rows; the 'Tasks' tab already surfaces them via InternTasksView)


type StatTone = 'plain' | 'violet' | 'yellow' | 'correct' | 'incorrect'

const TONE_STYLES: Record<StatTone, { bg: string; color: string }> = {
  plain:     { bg: 'var(--color-sunk)',          color: 'var(--color-ink)'      },
  violet:    { bg: 'var(--color-violet-soft)',   color: 'var(--color-violet)'   },
  yellow:    { bg: 'var(--color-yellow-soft)',   color: 'var(--color-waiting)'  },
  correct:   { bg: 'var(--color-correct-soft)',  color: 'var(--color-correct)'  },
  incorrect: { bg: 'var(--color-incorrect-soft)',color: 'var(--color-incorrect)'},
}

function HeaderStat({ label, value, tone = 'plain' }: { label: string; value: string; tone?: StatTone }) {
  const s = TONE_STYLES[tone]
  return (
    <div
      style={{
        minWidth: 104, borderRadius: 16, padding: '12px 16px',
        background: s.bg, color: s.color,
      }}
    >
      <span className="section-label" style={{ opacity: 0.7, color: s.color, display: 'block', marginBottom: 4 }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

// ─── Detail view ─────────────────────────────────────────────────────────────

function DetailView({ starter, onBack, orgId }: { starter: Starter; onBack: () => void; orgId: string }) {
  const [tab, setTab] = useState<'tasks' | 'knowledge'>('tasks')
  const pct = taskPct(starter)

  // Escape goes back
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onBack() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onBack])

  // Shared container: every row in this view aligns to the same column.
  const W: React.CSSProperties = { maxWidth: 1100, margin: '0 auto', padding: '0 24px', width: '100%' }

  return (
    // Plain block — the parent thin-scroll wrapper owns all scrolling.
    // No height, no overflow here.
    <div style={{ background: 'var(--color-page)', paddingBottom: 48 }}>

      {/* Back row */}
      <div style={{ ...W, paddingTop: 12, paddingBottom: 12 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 9999, border: 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: 'transparent', color: 'var(--color-ink-muted)',
            fontFamily: 'var(--font-sans)',
            transition: 'background 150ms, color 150ms',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-sunk)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-ink)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-ink-muted)' }}
        >
          <ArrowLeft size={16} /> All new starters
        </button>
      </div>

      {/* Header card */}
      <div style={{ ...W, paddingBottom: 20 }}>
        <div
          className="card"
          style={{
            padding: 28, display: 'flex', flexWrap: 'wrap',
            gap: 28, alignItems: 'flex-start',
          }}
        >
          {/* Identity */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <Avatar initials={starter.initials} size={72} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{starter.name}</div>
              <div style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 }}>
                {starter.jobTitle ?? 'Not set'} &middot; {starter.team ?? 'Not set'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-ink-muted)', marginTop: 4 }}>
                {starter.startDate ? <>Started {starter.startDate}</> : 'Start date not set'}
              </div>
            </div>
          </div>

          {/* Stats row — derived from real task counts */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
            <HeaderStat label="Tasks"    value={`${starter.taskDone}/${starter.taskTotal}`} tone="violet" />
            <HeaderStat label="Progress" value={`${pct}%`}                                  tone="plain"  />
          </div>

          {/* Progress track from real task counts */}
          <div className="track" style={{ width: '100%', height: 6, marginTop: 4 }}>
            <div className="track-fill" style={{ width: `${pct}%`, height: '100%' }} />
          </div>
        </div>
      </div>

      {/* Tab strip */}
      <div style={{ ...W, paddingBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['tasks', 'knowledge'] as const).map(t => (
            <button
              key={t} type="button"
              onClick={() => setTab(t)}
              style={{
                padding: '8px 16px', borderRadius: 9999, border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                textTransform: 'capitalize', fontFamily: 'var(--font-sans)',
                background: tab === t ? 'var(--color-accent-soft)' : 'transparent',
                color:      tab === t ? 'var(--color-accent)'      : 'var(--color-ink-muted)',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab body — keyed by starter so switching people remounts. */}
      <div key={starter.id}>
        {tab === 'tasks' && (
          <div style={{ ...W }}>
            <InternTasksView profileId={starter.id} />
          </div>
        )}
        {tab === 'knowledge' && (
          <div style={{ ...W }}>
            <AssignmentPanel profileId={starter.id} orgId={orgId} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SupervisorPageProps {
  name:    string
  company: string
  orgId:   string
  /** Real roster from the DB; empty array when no interns yet. */
  roster:  Starter[]
  /** Called when the supervisor submits an invite; returns an error string or null. */
  onInvite: (email: string, jobRoleId: string) => Promise<string | null>
}

export default function SupervisorPage({ name, company, orgId, roster, onInvite }: SupervisorPageProps) {
  const [search,    setSearch]    = useState('')
  const [selected,  setSelected]  = useState<Starter | null>(null)
  const [invite,    setInvite]    = useState(false)
  const [confirm,   setConfirm]   = useState('')

  const filtered = roster.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleSent(email: string, jobRoleId: string) {
    const err = await onInvite(email, jobRoleId)
    setInvite(false)
    if (err) {
      setConfirm(`Error: ${err}`)
    } else {
      setConfirm(`Invitation sent to ${email}`)
    }
    setTimeout(() => setConfirm(''), 5000)
  }

  if (selected) {
    return (
      <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <DetailView starter={selected} orgId={orgId} onBack={() => setSelected(null)} />
      </div>
    )
  }

  const noun = filtered.length === 1 ? 'new starter' : 'new starters'

  return (
    <div
      className="thin-scroll"
      style={{ flex: 1, overflowY: 'auto', background: 'var(--color-page)' }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 20, flexWrap: 'wrap' }}>
          <div>
            <span className="section-label" style={{ display: 'block', marginBottom: 6 }}>
              {name} &middot; {company || 'Brightfield'}
            </span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>
              {roster.length === 0
                ? 'No new starters yet'
                : `Onboarding, ${roster.length} ${roster.length === 1 ? 'new starter' : 'new starters'}`}
            </h1>
          </div>
          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 300, width: '100%' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink-muted)', pointerEvents: 'none' }}
            />
            <input
              type="search"
              className="field"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name…"
              style={{ paddingLeft: 44 }}
            />
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', textAlign: 'center', padding: '48px 0' }}>
            {search
              ? <>No new starters match &ldquo;{search}&rdquo;.</>
              : 'No new starters have been added yet. Use the button below to send your first invite.'}
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 20,
            }}
          >
            {filtered.map(s => (
              <StarterCard key={s.id} starter={s} onClick={() => setSelected(s)} />
            ))}
          </div>
        )}

        {/* Invite button */}
        <button
          type="button"
          className="btn-secondary"
          style={{ width: '100%', marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={() => setInvite(true)}
        >
          <Plus size={15} /> Invite new starter
        </button>
      </div>

      {/* Invite dialog */}
      {invite && (
        <InviteDialog
          onClose={() => setInvite(false)}
          onSent={handleSent}
        />
      )}

      {/* Confirmation toast */}
      {confirm && (
        <div
          className="animate-fade-up"
          style={{
            position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--color-ink)', color: '#fff',
            borderRadius: 9999, padding: '12px 24px',
            fontSize: 13, boxShadow: 'var(--shadow-float)',
            whiteSpace: 'nowrap', zIndex: 200,
          }}
        >
          {confirm}
        </div>
      )}
    </div>
  )
}
