import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { KYCAdminClient } from './kyc-admin-client'

export const dynamic = 'force-dynamic'

export default async function AdminKYCPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = user.app_metadata?.role
  if (role !== 'super_admin') redirect('/admin/queue')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingRaw } = await (supabase as any)
    .from('kyc_submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentRaw } = await (supabase as any)
    .from('kyc_submissions')
    .select('*')
    .in('status', ['approved', 'rejected', 'resubmit_required'])
    .order('reviewed_at', { ascending: false })
    .limit(20)

  const pending = (pendingRaw ?? []) as import('@/types/app').KYCSubmission[]
  const recent  = (recentRaw  ?? []) as import('@/types/app').KYCSubmission[]

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-xl font-bold mb-1">KYC Verification Queue</h1>
        <p className="text-sm text-gray-500 mb-6">
          {pending?.length ?? 0} pending · Review and approve identity documents
        </p>
        <KYCAdminClient pending={pending} recent={recent} />
      </div>
    </div>
  )
}
