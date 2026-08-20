/**
 * lib/invite-action.ts
 * Server Action: invite a new intern.
 *
 * Called from SupervisorClient — runs entirely server-side.
 * Uses the service role key to create the auth user and write DB rows.
 *
 * Guards:
 *  - Caller must have role === 'supervisor' in their JWT (from app_metadata).
 *  - Invited address must be well-formed.
 *  - job_role_id must exist and belong to the caller's organisation.
 *  - Writes: auth user, profiles row, tasks rows (from templates), invitations row.
 */
'use server'

import 'server-only'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  ProfileInsert,
  InvitationInsert,
  TaskInsert,
  QuizAssignmentInsert,
} from '@/lib/database.types'

/** Derives a display name from an email local part.
 *  "jamie.rivera" → "Jamie Rivera", "j_smith" → "J Smith", "alex-jones" → "Alex Jones"
 */
function nameFromEmail(localPart: string): string {
  return localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export async function inviteIntern(
  email: string,
  job_role_id: string,
): Promise<string | null> {
  // ── 1. Verify caller ─────────────────────────────────────────────────────

  const supabase = createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user) return 'Not authenticated.'

  const callerRole  = user.app_metadata?.role as string | undefined
  const callerOrgId = user.app_metadata?.org_id as string | undefined

  if (callerRole !== 'supervisor') return 'Only supervisors can send invitations.'
  if (!callerOrgId) return 'Your account is not linked to an organisation.'

  // ── 2. Validate the address ───────────────────────────────────────────────

  const cleanEmail = email.trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return 'That does not look like a valid email address.'
  }

  const admin = createAdminClient()

  // ── 3. Validate job_role_id belongs to caller's org ───────────────────────

  const { data: jobRole, error: roleErr } = await admin
    .from('job_roles')
    .select('id, name, org_id')
    .eq('id', job_role_id)
    .eq('org_id', callerOrgId)
    .single()

  if (roleErr || !jobRole) {
    return 'That job role does not exist in your organisation.'
  }

  // ── 4. Load org (for the invite email) ───────────────────────────────────

  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .select('id, name')
    .eq('id', callerOrgId)
    .single()

  if (orgErr || !org) return 'Could not load organisation details.'

  // ── 5. Create auth user ───────────────────────────────────────────────────

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: cleanEmail,
    app_metadata: {
      org_id: callerOrgId,
      role:   'intern',
    },
    email_confirm: true,
  })

  if (createErr || !created.user) {
    console.error('[inviteIntern] createUser:', createErr?.message)
    return 'Could not create account. The address may already be registered.'
  }

  const newUserId = created.user.id

  // ── 6. Write profile row ──────────────────────────────────────────────────

  const full_name = nameFromEmail(cleanEmail.split('@')[0] ?? cleanEmail)

  const profileInsert: ProfileInsert = {
    id:            newUserId,
    org_id:        callerOrgId,
    role:          'intern',
    full_name,
    supervisor_id: user.id,
    job_role_id:   job_role_id,
    job_title:     null,
    team:          null,
    start_date:    null,
  }

  const { error: profileErr } = await admin.from('profiles').insert(profileInsert)

  if (profileErr) {
    console.error('[inviteIntern] profiles insert:', profileErr.message)
    await admin.auth.admin.deleteUser(newUserId)
    return 'Failed to create profile. Please try again.'
  }

  // ── 7. Copy task templates → tasks ────────────────────────────────────────
  //
  // Non-fatal: if this fails the account still exists and the supervisor can
  // add tasks manually. We log the error and continue.

  const { data: templates, error: tmplErr } = await admin
    .from('task_templates')
    .select('id, title, description, order_index')
    .eq('job_role_id', job_role_id)
    .eq('org_id', callerOrgId)
    .order('order_index', { ascending: true })

  if (tmplErr) {
    console.error('[inviteIntern] fetch templates:', tmplErr.message)
  } else if (templates && templates.length > 0) {
    const taskRows: TaskInsert[] = templates.map(t => ({
      org_id:      callerOrgId,
      profile_id:  newUserId,
      template_id: t.id,
      title:       t.title,
      description: t.description,
      order_index: t.order_index,
      status:      'pending',
    }))

    const { error: tasksErr } = await admin.from('tasks').insert(taskRows)
    if (tasksErr) {
      console.error('[inviteIntern] tasks insert:', tasksErr.message)
      // Non-fatal — continue to invitation and email steps.
    }
  }

  // ── 8. Auto-assign quizzes attached to this job role ─────────────────────
  //
  // Non-fatal: if this fails the account still exists with tasks intact.

  const { data: roleQuizzes, error: rqErr } = await admin
    .from('job_role_quizzes')
    .select('quiz_id')
    .eq('job_role_id', job_role_id)

  if (rqErr) {
    console.error('[inviteIntern] fetch role quizzes:', rqErr.message)
  } else if (roleQuizzes && roleQuizzes.length > 0) {
    const assignmentRows: QuizAssignmentInsert[] = roleQuizzes.map(r => ({
      org_id:      callerOrgId,
      quiz_id:     r.quiz_id,
      profile_id:  newUserId,
      assigned_by: user.id,
    }))
    const { error: qaErr } = await admin.from('quiz_assignments').insert(assignmentRows)
    if (qaErr) {
      console.error('[inviteIntern] quiz_assignments insert:', qaErr.message)
    }
  }

  // ── 9. Write invitation row ───────────────────────────────────────────────

  const invitationInsert: InvitationInsert = {
    org_id:     callerOrgId,
    email:      cleanEmail,
    role:       'intern',
    invited_by: user.id,
    status:     'pending',
  }

  const { error: invErr } = await admin.from('invitations').insert(invitationInsert)

  if (invErr) {
    console.error('[inviteIntern] invitations insert:', invErr.message)
  }

  // ── 9. Send the invite email ──────────────────────────────────────────────

  const loginUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/login`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.INVITE_FROM_EMAIL,
        to:   cleanEmail,
        subject: `You've been added to Compass`,
        text: [
          `${org.name} has set up a Compass account for you as ${jobRole.name}.`,
          ``,
          `Go to ${loginUrl}, enter this address, and we'll send you a sign-in code.`,
        ].join('\n'),
      }),
    })

    if (!res.ok) {
      console.error('[inviteIntern] resend:', res.status, await res.text())
    }
  } catch (err) {
    console.error('[inviteIntern] resend:', err)
  }

  return null // null = success
}
