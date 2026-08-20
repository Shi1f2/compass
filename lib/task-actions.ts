/**
 * lib/task-actions.ts
 * Server Action for toggling an intern's task status.
 *
 * RLS policy "tasks: intern update own" enforces that only the owning intern
 * can update their task's status column. The DB trigger tasks_intern_update_guard
 * additionally enforces:
 *   - Only `status` may be changed by the intern
 *   - `completed_at` is set/cleared by the trigger, not the caller
 */
'use server'

import { createClient } from '@/lib/supabase/server'

export async function toggleTaskStatus(
  taskId: string,
  newStatus: 'pending' | 'done',
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('tasks')
    .update({ status: newStatus })
    .eq('id', taskId)
    .eq('profile_id', user.id)   // redundant with RLS; defence-in-depth

  if (error) return { error: error.message }
  return { error: null }
}
