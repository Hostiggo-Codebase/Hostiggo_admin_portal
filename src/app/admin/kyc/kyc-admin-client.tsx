'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { reviewKYC, getKYCDocumentSignedUrl } from '@/lib/services/ticketService'
import { KYCStatusBadge } from '@/components/kyc/kyc-status-badge'
import type { KYCSubmission, KYCStatus } from '@/types/app'
import { formatDate } from '@/lib/utils'

const DOC_LABELS: Record<string, string> = {
  passport:         'Passport',
  driving_license:  'Driving Licence',
  national_id:      'National ID Card',
  other:            'Other Government ID',
}

function DocumentPreview({ path, label }: { path: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const signed = await getKYCDocumentSignedUrl(path)
      setUrl(signed)
    } finally {
      setLoading(false)
    }
  }

  if (url) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <a href={url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="w-full max-h-48 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity cursor-pointer" />
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <button
        onClick={load}
        disabled={loading}
        className="w-full h-24 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'View document'}
      </button>
    </div>
  )
}

function KYCReviewCard({ submission, onReviewed }: { submission: KYCSubmission; onReviewed: () => void }) {
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [showResubmitForm, setShowResubmitForm] = useState(false)

  const { mutate, isPending } = useMutation({
    mutationFn: ({ status, reason }: { status: 'approved' | 'rejected' | 'resubmit_required'; reason?: string }) =>
      reviewKYC(submission.id, status, reason),
    onSuccess: onReviewed,
  })

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {DOC_LABELS[submission.document_type] ?? submission.document_type}
          </p>
          <p className="text-xs text-gray-500">
            User: <span className="font-mono">{submission.user_id.slice(0, 12)}…</span>
            {' · '}Submitted {formatDate(submission.created_at)}
          </p>
        </div>
        <KYCStatusBadge status={submission.status as KYCStatus} />
      </div>

      {/* Document images */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DocumentPreview path={submission.document_front_path} label="Front" />
        {submission.document_back_path && (
          <DocumentPreview path={submission.document_back_path} label="Back" />
        )}
        {submission.selfie_path && (
          <DocumentPreview path={submission.selfie_path} label="Selfie" />
        )}
      </div>

      {/* Actions */}
      {submission.status === 'pending' && (
        <div className="px-4 pb-4 space-y-3">
          {!showRejectForm && !showResubmitForm && (
            <div className="flex gap-2">
              <button
                onClick={() => mutate({ status: 'approved' })}
                disabled={isPending}
                className="flex-1 bg-green-600 text-white py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-40"
              >
                {isPending ? 'Saving…' : 'Approve'}
              </button>
              <button
                onClick={() => setShowResubmitForm(true)}
                disabled={isPending}
                className="flex-1 border border-orange-300 text-orange-700 py-2 rounded-md text-sm font-medium hover:bg-orange-50 disabled:opacity-40"
              >
                Request resubmit
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                disabled={isPending}
                className="flex-1 border border-red-300 text-red-700 py-2 rounded-md text-sm font-medium hover:bg-red-50 disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          )}

          {(showRejectForm || showResubmitForm) && (
            <div className="space-y-2">
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder={showResubmitForm ? 'What needs to be corrected?' : 'Reason for rejection…'}
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowRejectForm(false); setShowResubmitForm(false) }}
                  className="flex-1 border border-gray-300 rounded-md py-2 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => mutate({
                    status: showResubmitForm ? 'resubmit_required' : 'rejected',
                    reason: rejectionReason.trim() || undefined,
                  })}
                  disabled={isPending}
                  className={`flex-1 py-2 rounded-md text-sm font-medium text-white disabled:opacity-40 ${
                    showResubmitForm ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isPending ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function KYCAdminClient({
  pending,
  recent,
}: {
  pending: KYCSubmission[]
  recent: KYCSubmission[]
}) {
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())

  const visiblePending = pending.filter(s => !reviewed.has(s.id))

  function markReviewed(id: string) {
    setReviewed(prev => new Set(Array.from(prev).concat(id)))
  }

  return (
    <div className="space-y-8">
      {/* Pending */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Pending ({visiblePending.length})
        </h2>
        {visiblePending.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
            No pending KYC submissions
          </div>
        ) : (
          <div className="space-y-4">
            {visiblePending.map(s => (
              <KYCReviewCard key={s.id} submission={s} onReviewed={() => markReviewed(s.id)} />
            ))}
          </div>
        )}
      </section>

      {/* Recently reviewed */}
      {recent.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Recently reviewed
          </h2>
          <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
            {recent.map(s => (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                <KYCStatusBadge status={s.status as KYCStatus} />
                <span className="text-gray-600">{DOC_LABELS[s.document_type] ?? s.document_type}</span>
                <span className="font-mono text-xs text-gray-400">{s.user_id.slice(0, 12)}…</span>
                <span className="ml-auto text-xs text-gray-400">
                  {s.reviewed_at ? formatDate(s.reviewed_at) : '—'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
