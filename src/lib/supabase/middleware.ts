import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'
import { getAdminAccess } from '@/lib/auth/admin-access'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kqrzynfafnybdxnaugte.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtxcnp5bmZhZm55YmR4bmF1Z3RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNDc3MzYsImV4cCI6MjA5OTkyMzczNn0.Ke3c7_EPke22TH69v8nVsv6adQ5dz3-wz0ltncqTk1E'

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
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
    const admin = await getAdminAccess(supabase, user.id)
    if (!admin) {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
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
