import type { KYCStatus } from '@/types/app'

const config: Record<KYCStatus | 'not_submitted', { label: string; className: string }> = {
  not_submitted:    { label: 'Not submitted',   className: 'bg-gray-100 text-gray-600' },
  pending:          { label: 'Under review',    className: 'bg-yellow-100 text-yellow-700' },
  approved:         { label: 'Verified',        className: 'bg-green-100 text-green-700' },
  rejected:         { label: 'Rejected',        className: 'bg-red-100 text-red-700' },
  resubmit_required:{ label: 'Resubmit needed', className: 'bg-orange-100 text-orange-700' },
}

export function KYCStatusBadge({ status }: { status: KYCStatus | 'not_submitted' }) {
  const { label, className } = config[status] ?? config.not_submitted
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
