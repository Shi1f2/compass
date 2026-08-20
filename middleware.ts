/**
 * middleware.ts
 * Refreshes the Supabase auth session on every request.
 * Guard logic lives in per-layout server components, not here —
 * the sole job of this middleware is to keep the session cookie fresh.
 *
 * Uses @supabase/ssr createServerClient with request/response cookies
 * as documented at https://supabase.com/docs/guides/auth/server-side/nextjs
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { CleanDatabase } from '@/lib/database.types'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<CleanDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[], headers?: Record<string, string>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
          if (headers) {
            Object.entries(headers).forEach(([key, value]) =>
              supabaseResponse.headers.set(key, value),
            )
          }
        },
      },
    },
  )

  // Refresh the session — do NOT remove this call.
  // It updates the session cookie if the access token has expired.
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - _next/static (static files)
     *  - _next/image  (image optimisation)
     *  - favicon.ico  (favicon)
     *  - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
