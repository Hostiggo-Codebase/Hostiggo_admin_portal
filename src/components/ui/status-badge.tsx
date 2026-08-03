import { cn } from '@/lib/utils'
import type { TicketStatus } from '@/types/app'

const STATUS_STYLES: Record<TicketStatus, string> = {
  QUEUED:          'bg-yellow-100 text-yellow-800',
  ASSIGNED:        'bg-blue-100 text-blue-800',
  ACTIVE:          'bg-green-100 text-green-800',
  WAITING_ON_USER: 'bg-orange-100 text-orange-800',
  ESCALATED:       'bg-red-100 text-red-800',
  RESOLVED:        'bg-gray-100 text-gray-700',
  CLOSED:          'bg-gray-200 text-gray-500',
  REOPENED:        'bg-purple-100 text-purple-800',
  DEFERRED:        'bg-slate-100 text-slate-700',
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', STATUS_STYLES[status])}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
