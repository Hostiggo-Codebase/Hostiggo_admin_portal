import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminAccess } from '@/lib/auth/admin-access'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = await getAdminAccess(supabase, user.id)
  if (admin) redirect('/admin/queue')

  redirect('/login?error=unauthorized')
}
