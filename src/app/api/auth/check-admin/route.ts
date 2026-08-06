import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // Use Supabase service role to query
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if email exists in admin_users table
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('admin_id, role, display_name, email')
      .eq('email', email)
      .single()

    if (error || !adminUser) {
      console.error(`User not in admin_users: ${email}`, error)
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    }

    return NextResponse.json({ 
      adminData: {
        id: adminUser.admin_id,
        role: adminUser.role,
        display_name: adminUser.display_name,
        email: adminUser.email
      }
    }, { status: 200 })
  } catch (error) {
    console.error('Error checking admin status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
