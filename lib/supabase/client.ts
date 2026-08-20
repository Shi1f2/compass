/**
 * lib/supabase/client.ts
 * Browser-side Supabase client.
 * Safe to import from Client Components.
 *
 * All three generics are passed explicitly to createBrowserClient so TypeScript
 * never has to infer Schema through the deferred conditional inside SupabaseClient.
 * Inferring Schema causes it to resolve to `never` due to a TS deferred-conditional
 * deferral bug when the constraint contains generic parameters (@supabase/supabase-js
 * v2.112 + TypeScript 5.x).
 */
import { createBrowserClient } from '@supabase/ssr'
import type { CleanDatabase } from '@/lib/database.types'

export function createClient() {
  return createBrowserClient<CleanDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
