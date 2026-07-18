'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getQueueTickets } from '@/lib/services/ticketService'
import { StatusBadge } from '@/components/ui/status-badge'
import { SlaBadge } from '@/components/ui/sla-badge'
import { timeAgo } from '@/lib/utils'
import type { TicketStatus, PriorityLabel } from '@/types/app'
import { createClient } from '@/lib/supabase/client'
import { useMyAssignments } from '@/hooks/useMyAssignments'

const STATUSES: TicketStatus[] = ['QUEUED','ASSIGNED','ACTIVE','WAITING_ON_USER','ESCALATED','REOPENED']

export default function QueuePage() {
  const [filterStatus, setFilterStatus] = useState<TicketStatus | ''>('')
  const [filterPriority, setFilterPriority] = useState<PriorityLabel | ''>('')
  const qc = useQueryClient()

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['queue'],
    queryFn: getQueueTickets,
    refetchInterval: 15_000,
  })

  const [agentId, setAgentId] = useState<string | null>(null)
  useState(() => {
    createClient().auth.getUser().then(({ data }) => setAgentId(data.user?.id ?? null))
  })
  useMyAssignments(agentId)

  const filtered = tickets.filter(t =>
    (!filterStatus   || t.status === filterStatus) &&
    (!filterPriority || t.priority_label === filterPriority)
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="border-b bg-white px-6 py-4 flex items-center gap-4">
        <h1 className="text-lg font-semibold flex-1">Ticket Queue</h1>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as TicketStatus | '')}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value as PriorityLabel | '')}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm"
        >
          <option value="">All priorities</option>
          {['Urgent','Payment-Refund','Booking Help','General'].map(p => <option key={p}>{p}</option>)}
        </select>
        <button onClick={() => qc.invalidateQueries({ queryKey: ['queue'] })}
          className="text-sm text-gray-500 hover:text-black">
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Queue is empty</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b">
              <tr>
                {['#', 'Subject', 'Priority', 'Status', 'SLA', 'Age', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(t => {
                const breached = !t.first_response_at &&
                  (Date.now() - new Date(t.created_at).getTime()) >
                  ({ Urgent: 5, 'Payment-Refund': 10, 'Booking Help': 15, General: 30 }[t.priority_label] ?? 30) * 60000

                return (
                  <tr key={t.ticket_id}
                    className={`hover:bg-gray-50 ${breached ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.ticket_number}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-xs">{t.subject}</p>
                      <p className="text-xs text-gray-400">{(t.complaint_categories as { name: string } | null)?.name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium">{t.priority_label}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status as TicketStatus} /></td>
                    <td className="px-4 py-3">
                      <SlaBadge
                        priorityLabel={t.priority_label}
                        createdAt={t.created_at}
                        firstResponseAt={t.first_response_at}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{timeAgo(t.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/tickets/${t.ticket_id}`}
                        className="text-xs text-blue-600 hover:underline">
                        Open →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
