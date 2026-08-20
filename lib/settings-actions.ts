/**
 * lib/settings-actions.ts
 * Server Actions for job-role and task-template CRUD.
 *
 * Auth pattern:
 *  1. Verify caller via createClient() (SSR) — role must be 'supervisor'.
 *  2. org_id is read from the JWT app_metadata, never from client input.
 *     This means a crafted call cannot scope writes to a different org.
 *  3. All DB writes use the same SSR client. RLS enforces org isolation:
 *     every supervisor write policy checks org_id = JWT app_metadata org_id.
 */
'use server'

import { createClient } from '@/lib/supabase/server'
import type { JobRoleInsert, TaskTemplateInsert } from '@/lib/database.types'

// ─── Auth helper ──────────────────────────────────────────────────────────────

/**
 * Returns { id, orgId } for the authenticated supervisor, or null.
 * orgId is read from JWT app_metadata — not from any client-supplied value.
 */
async function requireSupervisor(): Promise<{ id: string; orgId: string } | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'supervisor') return null
  const orgId: string | undefined = user.app_metadata?.org_id
  if (!orgId) return null
  return { id: user.id, orgId }
}

// ─── Job roles ────────────────────────────────────────────────────────────────

export async function createJobRole(
  name: string,
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  const db = createClient()
  // orgId sourced from JWT, not from any client parameter.
  const row: JobRoleInsert = { org_id: caller.orgId, name: name.trim() }
  const { error } = await db.from('job_roles').insert(row)
  if (error) {
    return {
      error: error.message.includes('unique') || error.code === '23505'
        ? `A role named "${name.trim()}" already exists.`
        : error.message,
    }
  }
  return { error: null }
}

export async function renameJobRole(
  id: string,
  name: string,
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  // RLS policy also scopes to org; the .eq('org_id') is defence-in-depth.
  const db = createClient()
  const { error } = await db
    .from('job_roles')
    .update({ name: name.trim() })
    .eq('id', id)
    .eq('org_id', caller.orgId)
  if (error) {
    return {
      error: error.message.includes('unique') || error.code === '23505'
        ? 'A role with that name already exists.'
        : error.message,
    }
  }
  return { error: null }
}

export async function deleteJobRole(
  id: string,
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  const db = createClient()
  const { error } = await db
    .from('job_roles')
    .delete()
    .eq('id', id)
    .eq('org_id', caller.orgId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function countProfilesForRole(
  roleId: string,
): Promise<{ count: number; error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { count: 0, error: 'Unauthorized' }

  const { count, error } = await createClient()
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('job_role_id', roleId)
    .eq('org_id', caller.orgId)
  if (error) return { count: 0, error: error.message }
  return { count: count ?? 0, error: null }
}

// ─── Task templates ───────────────────────────────────────────────────────────

export async function createTaskTemplate(
  jobRoleId: string,
  title: string,
  orderIndex: number,
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  const db = createClient()

  // Verify job_role_id belongs to caller's org before inserting a template.
  // RLS on task_templates (insert) also checks this via a join; belt-and-suspenders.
  const { data: role } = await db
    .from('job_roles')
    .select('id')
    .eq('id', jobRoleId)
    .eq('org_id', caller.orgId)
    .maybeSingle()
  if (!role) return { error: 'Job role not found in your organisation.' }

  const row: TaskTemplateInsert = {
    org_id:      caller.orgId,
    job_role_id: jobRoleId,
    title:       title.trim(),
    order_index: orderIndex,
  }
  const { error } = await db.from('task_templates').insert(row)
  if (error) return { error: error.message }
  return { error: null }
}

export async function renameTaskTemplate(
  id: string,
  title: string,
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  const db = createClient()
  const { error } = await db
    .from('task_templates')
    .update({ title: title.trim() })
    .eq('id', id)
    .eq('org_id', caller.orgId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function deleteTaskTemplate(
  id: string,
): Promise<{ error: string | null }> {
  const caller = await requireSupervisor()
  if (!caller) return { error: 'Unauthorized' }

  const db = createClient()
  const { error } = await db
    .from('task_templates')
    .delete()
    .eq('id', id)
    .eq('org_id', caller.orgId)
  if (error) return { error: error.message }
  return { error: null }
}
