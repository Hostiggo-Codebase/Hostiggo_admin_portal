'use client'

import { useState } from 'react'
import { KYCForm } from '@/components/kyc/kyc-form'
import { KYCStatusBadge } from '@/components/kyc/kyc-status-badge'
import type { UserKYCStatus, KYCSubmission, KYCStatus } from '@/types/app'
import { formatDate } from '@/lib/utils'

interface Props {
  kycStatus: UserKYCStatus | null
  latestSubmission: KYCSubmission | null
}

const DOC_LABELS: Record<string, string> = {
  passport:         'Passport',
  driving_license:  'Driving Licence',
  national_id:      'National ID Card',
  other:            'Other Government ID',
}

export function KYCPageClient({ kycStatus, latestSubmission }: Props) {
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className="border border-gray-200 rounded-xl p-6 text-center space-y-3">
        <div className="text-3xl">✓</div>
        <h2 className="font-semibold text-gray-900">Documents submitted</h2>
        <p className="text-sm text-gray-500">
          Our team will review your submission within 1–2 business days.
          You will be notified by email once verified.
        </p>
        <KYCStatusBadge status="pending" />
      </div>
    )
  }

  const status = (latestSubmission?.status ?? 'not_submitted') as KYCStatus | 'not_submitted'

  // Verified
  if (kycStatus?.is_verified) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✓</span>
          <div>
            <p className="font-semibold text-green-800">Identity verified</p>
            {kycStatus.last_verified_at && (
              <p className="text-sm text-green-700">Verified on {formatDate(kycStatus.last_verified_at)}</p>
            )}
          </div>
          <KYCStatusBadge status="approved" />
        </div>
        {latestSubmission && (
          <p className="text-xs text-green-700">
            Document: {DOC_LABELS[latestSubmission.document_type] ?? latestSubmission.document_type}
          </p>
        )}
      </div>
    )
  }

  // Pending review
  if (status === 'pending') {
    return (
      <div className="border border-yellow-200 bg-yellow-50 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⏳</span>
          <div>
            <p className="font-semibold text-yellow-800">Verification under review</p>
            {latestSubmission && (
              <p className="text-sm text-yellow-700">Submitted {formatDate(latestSubmission.created_at)}</p>
            )}
          </div>
          <KYCStatusBadge status="pending" />
        </div>
        <p className="text-xs text-yellow-700">
          Our team typically reviews submissions within 1–2 business days.
        </p>
      </div>
    )
  }

  // Rejected or resubmit required
  if (status === 'rejected' || status === 'resubmit_required') {
    return (
      <div className="space-y-6">
        <div className="border border-red-200 bg-red-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <KYCStatusBadge status={status} />
            <p className="text-sm font-medium text-red-800">
              {status === 'rejected' ? 'Verification rejected' : 'Resubmission required'}
            </p>
          </div>
          {latestSubmission?.rejection_reason && (
            <p className="text-sm text-red-700">{latestSubmission.rejection_reason}</p>
          )}
        </div>
        <div className="border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Submit new documents</h2>
          <KYCForm onSuccess={() => setSubmitted(true)} />
        </div>
      </div>
    )
  }

  // Not submitted yet
  return (
    <div className="border border-gray-200 rounded-xl p-6">
      <KYCForm onSuccess={() => setSubmitted(true)} />
    </div>
  )
}
