/**
 * lib/supabase/server.ts
 * Server-side Supabase client (SSR).
 * Safe to import from Server Components, Route Handlers, and Server Actions.
 * Reads and writes the auth cookie via Next.js cookies().
 *
 * All three generics are passed explicitly to createServerClient.
 * @supabase/ssr 0.5.x had a bug where createServerClient collapsed mutation
 * parameter types to `never` due to deferred conditional type resolution.
 * This was fixed in @supabase/ssr 0.12.4 — confirmed by probe on 2025-01-08.
 * The client is now safe to use for both reads and writes in server actions.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { CleanDatabase } from '@/lib/database.types'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient<CleanDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — cookie writes are a no-op.
            // The middleware is responsible for refreshing the session in that case.
          }
        },
      },
    },
  )
}
