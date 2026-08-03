import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { id, email, name, image, role, provider, emailVerified } = await request.json()

    // Add user to Supabase
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // Check if user exists in Supabase
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (!existingUser) {
      // Create new user - just insert the data directly
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          id,
          email,
          Name: name,
          image,
          role,
          provider,
          emailVerified: emailVerified || false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any)
        .select()
        .single()

      if (error) {
        console.error('Error creating user:', error)
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
      }

      return NextResponse.json({ user: newUser }, { status: 201 })
    }

    return NextResponse.json({ user: existingUser }, { status: 200 })
  } catch (error) {
    console.error('Error syncing user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

