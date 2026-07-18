import { cn, msToHuman } from '@/lib/utils'

const SLA_FIRST_RESPONSE_MS: Record<string, number> = {
  'Urgent':         5  * 60 * 1000,
  'Payment-Refund': 10 * 60 * 1000,
  'Booking Help':   15 * 60 * 1000,
  'General':        30 * 60 * 1000,
}

interface Props {
  priorityLabel: string
  createdAt: string
  firstResponseAt: string | null
}

export function SlaBadge({ priorityLabel, createdAt, firstResponseAt }: Props) {
  const target = SLA_FIRST_RESPONSE_MS[priorityLabel]
  if (!target) return null

  const elapsed = (firstResponseAt ? new Date(firstResponseAt) : new Date()).getTime()
    - new Date(createdAt).getTime()

  const breached = !firstResponseAt && elapsed > target

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
      breached ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
    )}>
      {breached ? `SLA BREACHED (${msToHuman(elapsed)})` : `SLA OK (target ${msToHuman(target)})`}
    </span>
  )
}
