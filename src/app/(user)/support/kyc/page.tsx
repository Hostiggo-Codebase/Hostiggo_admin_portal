import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { KYCPageClient } from './kyc-page-client'

export const dynamic = 'force-dynamic'

export default async function KYCPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: kycStatusRaw } = await (supabase as any)
    .from('user_kyc_status')
    .select('*')
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kycStatus = kycStatusRaw as import('@/types/app').UserKYCStatus | null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: latestSubmissionRaw } = kycStatus?.latest_submission_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (supabase as any)
        .from('kyc_submissions')
        .select('*')
        .eq('id', kycStatus.latest_submission_id)
        .single()
    : { data: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestSubmission = latestSubmissionRaw as import('@/types/app').KYCSubmission | null

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <div className="mb-6">
        <a href="/support" className="text-sm text-gray-500 hover:text-black">← My Tickets</a>
        <h1 className="text-2xl font-bold mt-2">Identity Verification</h1>
        <p className="text-sm text-gray-500 mt-1">
          Verify your identity to unlock priority support and refund processing.
        </p>
      </div>

      <KYCPageClient kycStatus={kycStatus} latestSubmission={latestSubmission} />
    </div>
  )
}
