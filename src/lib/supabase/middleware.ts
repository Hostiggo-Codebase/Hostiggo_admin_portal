import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    // Check for NextAuth session via cookies or headers
    const sessionToken = request.cookies.get('next-auth.session-token')?.value ||
                        request.cookies.get('__Secure-next-auth.session-token')?.value

    if (!sessionToken) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Protect user support routes
  if (pathname.startsWith('/support')) {
    const sessionToken = request.cookies.get('next-auth.session-token')?.value ||
                        request.cookies.get('__Secure-next-auth.session-token')?.value

    if (!sessionToken) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return supabaseResponse
}
