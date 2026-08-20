/**
 * lib/supabase/admin.ts
 * Service-role Supabase client.
 * SERVER-ONLY — never import from a Client Component or a NEXT_PUBLIC_ path.
 * Used exclusively by the provision script and the invite server action.
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// This function is intentionally not exported as a singleton so that
// each server action / script call gets a fresh client.
export function createAdminClient() {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !secret) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.',
    )
  }

  return createClient<Database>(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  })
}
