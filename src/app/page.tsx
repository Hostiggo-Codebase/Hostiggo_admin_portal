import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrProvisionAdminAccess } from '@/lib/auth/admin-access'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = await getOrProvisionAdminAccess(supabase, user)
  if (admin) redirect('/admin/queue')

  redirect('/login?error=unauthorized')
}
