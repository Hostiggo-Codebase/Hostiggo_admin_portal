import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {
    // Ignore if no Supabase session
  }

  const response = NextResponse.redirect(new URL('/login?loggedout=1', request.url), {
    status: 302,
  })

  // Clear all NextAuth session cookies
  response.cookies.delete('next-auth.session-token')
  response.cookies.delete('__Secure-next-auth.session-token')
  response.cookies.delete('next-auth.csrf-token')
  response.cookies.delete('__Host-next-auth.csrf-token')
  response.cookies.delete('next-auth.callback-url')

  return response
}

export async function GET(request: Request) {
  return POST(request)
}
