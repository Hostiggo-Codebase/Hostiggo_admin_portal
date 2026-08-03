import { cn } from '@/lib/utils'
import type { TicketStatus } from '@/types/app'

const STATUS_STYLES: Record<TicketStatus, string> = {
  QUEUED:          'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800',
  ASSIGNED:        'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
  ACTIVE:          'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800',
  WAITING_ON_USER: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800',
  ESCALATED:       'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800',
  RESOLVED:        'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800',
  CLOSED:          'bg-slate-200 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700',
  REOPENED:        'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
  DEFERRED:        'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800',
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold', STATUS_STYLES[status])}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
