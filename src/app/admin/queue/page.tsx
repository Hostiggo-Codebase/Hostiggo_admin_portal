'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getQueueTickets, fetchReviewBatch } from '@/lib/services/ticketService'
import { StatusBadge } from '@/components/ui/status-badge'
import { timeAgo } from '@/lib/utils'
import type { TicketStatus, PriorityLabel } from '@/types/app'
import { Layers } from 'lucide-react'
import { getSocket } from '@/hooks/useTicketChat'

const STATUSES: TicketStatus[] = ['QUEUED','ASSIGNED','ACTIVE','WAITING_ON_USER','ESCALATED','REOPENED']
const PRIORITIES: PriorityLabel[] = ['Urgent','Payment-Refund','Booking Help','General']

export default function QueuePage() {
  const router = useRouter()
  const [filterStatus, setFilterStatus] = useState<TicketStatus | ''>('')
  const [filterPriority, setFilterPriority] = useState<PriorityLabel | ''>('')
  const qc = useQueryClient()

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['queue'],
    queryFn: getQueueTickets,
    refetchInterval: 5_000,
  })

  // Live: the socket server tells agents when a customer writes (new ticket or new message).
  useEffect(() => {
    const socket = getSocket()
    const join = () => socket.emit('join_agents')
    const refresh = () => qc.invalidateQueries({ queryKey: ['queue'] })
    if (socket.connected) join()
    socket.on('connect', join)
    socket.on('queue_updated', refresh)
    socket.on('global_chat_activity', refresh)
    return () => {
      socket.off('connect', join)
      socket.off('queue_updated', refresh)
      socket.off('global_chat_activity', refresh)
    }
  }, [qc])

  const batchM = useMutation({
    mutationFn: () => fetchReviewBatch(10),
    onSuccess: (ids) => {
      qc.invalidateQueries({ queryKey: ['queue'] })
      qc.invalidateQueries({ queryKey: ['my-assigned'] })
      if (ids.length > 0) router.push(`/admin/tickets/${ids[0]}`)
    },
  })

  const filtered = tickets.filter(t =>
    (!filterStatus   || t.status === filterStatus) &&
    (!filterPriority || t.priority_label === filterPriority)
  )

  const queuedCount = tickets.filter(t => t.status === 'QUEUED').length

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="border-b bg-white px-5 py-3 flex items-center gap-3 shrink-0">
        <div className="flex-1">
          <h1 className="text-base font-semibold text-gray-900">Review Queue</h1>
          <p className="text-xs text-gray-500">
            {queuedCount} waiting · {tickets.length} total
          </p>
        </div>

        {/* Batch fetch button */}
        <button
          onClick={() => batchM.mutate()}
          disabled={batchM.isPending || queuedCount === 0}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          title="Claim up to 10 queued records and start reviewing"
        >
          <Layers size={15} />
          {batchM.isPending ? 'Claiming…' : `Fetch Batch${queuedCount > 0 ? ` (${Math.min(queuedCount, 10)})` : ''}`}
        </button>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as TicketStatus | '')}
          className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 bg-white"
        >
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>

        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value as PriorityLabel | '')}
          className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 bg-white"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>

        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['queue'] })}
          className="text-xs text-gray-500 hover:text-gray-900 font-medium px-2 py-1.5"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-sm text-gray-400 gap-2">
            <Layers size={28} className="text-gray-300" />
            <p>Queue is empty</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b">
              <tr>
                {['#', 'Subject', 'Priority', 'Status', 'Age', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(t => (
                <tr key={t.ticket_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{t.ticket_number}</td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium text-gray-900 truncate">{t.subject}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(t.complaint_categories as { name: string } | null)?.name}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      t.priority_label === 'Urgent'         ? 'bg-red-100 text-red-700' :
                      t.priority_label === 'Payment-Refund' ? 'bg-orange-100 text-orange-700' :
                      t.priority_label === 'Booking Help'   ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{t.priority_label}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={t.status as TicketStatus} /></td>
                  <td className="px-4 py-3 text-xs text-gray-400">{timeAgo(t.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/tickets/${t.ticket_id}`}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
                      {t.status === 'QUEUED' ? 'Take →' : 'Open →'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

