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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    const role = user.app_metadata?.role
    if (role !== 'agent' && role !== 'super_admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Protect user support routes
  if (pathname.startsWith('/support')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return supabaseResponse
}
