'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  changeStatus, escalateTicket, transferTicket, getAvailableAgents,
} from '@/lib/services/ticketService'
import { StatusBadge } from '@/components/ui/status-badge'
import { SlaBadge } from '@/components/ui/sla-badge'
import { formatDate } from '@/lib/utils'
import type { TicketWithDetails } from '@/types/app'

interface Props {
  ticket: TicketWithDetails
  isSuperAdmin: boolean
}

export function TicketSidePanel({ ticket, isSuperAdmin }: Props) {
  const [escalateReason, setEscalateReason] = useState('')
  const [showEscalate, setShowEscalate] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferTarget, setTransferTarget] = useState('')
  const qc = useQueryClient()

  const invalidate = () => qc.invalidateQueries({ queryKey: ['ticket', ticket.ticket_id] })

  const resolveM = useMutation({ mutationFn: () => changeStatus(ticket.ticket_id, 'RESOLVED'), onSuccess: invalidate })
  const waitM    = useMutation({ mutationFn: () => changeStatus(ticket.ticket_id, 'WAITING_ON_USER'), onSuccess: invalidate })
  const escalateM = useMutation({
    mutationFn: () => escalateTicket(ticket.ticket_id, escalateReason),
    onSuccess: () => { setShowEscalate(false); invalidate() },
  })
  const transferM = useMutation({
    mutationFn: () => transferTicket(ticket.ticket_id, transferTarget),
    onSuccess: () => { setShowTransfer(false); invalidate() },
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['available-agents'],
    queryFn: getAvailableAgents,
    enabled: showTransfer,
  })

  const { ticket_id, ticket_number, subject, status, priority_label, created_at, first_response_at, complaint_categories } = ticket

  return (
    <div className="w-80 border-l bg-gray-50 flex flex-col overflow-y-auto">
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-gray-500">{ticket_number}</span>
          <StatusBadge status={status} />
        </div>
        <h3 className="font-semibold text-sm line-clamp-2">{subject}</h3>
      </div>

      <div className="p-4 space-y-3 text-sm">
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">Category</span>
          <p className="font-medium">{complaint_categories?.name}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">Priority</span>
          <p className="font-medium">{priority_label}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">Created</span>
          <p>{formatDate(created_at)}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">SLA</span>
          <SlaBadge
            priorityLabel={priority_label}
            createdAt={created_at}
            firstResponseAt={first_response_at}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t space-y-2">
        {status === 'ACTIVE' && (
          <>
            <button
              onClick={() => waitM.mutate()}
              disabled={waitM.isPending}
              className="w-full text-sm py-1.5 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              Mark Waiting on User
            </button>
            <button
              onClick={() => resolveM.mutate()}
              disabled={resolveM.isPending}
              className="w-full text-sm py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              Resolve
            </button>
            <button
              onClick={() => setShowEscalate(v => !v)}
              className="w-full text-sm py-1.5 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Escalate to Super Admin
            </button>
          </>
        )}
        {status === 'WAITING_ON_USER' && (
          <button
            onClick={() => resolveM.mutate()}
            className="w-full text-sm py-1.5 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Resolve
          </button>
        )}
        {(status === 'ACTIVE' || status === 'ASSIGNED') && (
          <button
            onClick={() => setShowTransfer(v => !v)}
            className="w-full text-sm py-1.5 border border-gray-300 rounded hover:bg-gray-100"
          >
            Transfer
          </button>
        )}

        {showEscalate && (
          <div className="space-y-2 pt-2 border-t">
            <textarea
              value={escalateReason}
              onChange={e => setEscalateReason(e.target.value)}
              placeholder="Reason for escalation…"
              rows={3}
              className="w-full border rounded px-2 py-1 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-red-400"
            />
            <button
              onClick={() => escalateM.mutate()}
              disabled={!escalateReason.trim() || escalateM.isPending}
              className="w-full text-sm py-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {escalateM.isPending ? 'Escalating…' : 'Confirm Escalate'}
            </button>
          </div>
        )}

        {showTransfer && (
          <div className="space-y-2 pt-2 border-t">
            <select
              value={transferTarget}
              onChange={e => setTransferTarget(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            >
              <option value="">Select agent…</option>
              {agents.map(a => (
                <option key={a.admin_id} value={a.admin_id}>
                  {a.display_name} ({a.active_chat_count}/2)
                </option>
              ))}
            </select>
            <button
              onClick={() => transferM.mutate()}
              disabled={!transferTarget || transferM.isPending}
              className="w-full text-sm py-1.5 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {transferM.isPending ? 'Transferring…' : 'Confirm Transfer'}
            </button>
          </div>
        )}
      </div>

      {/* History */}
      <div className="p-4 border-t">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status History</p>
        <div className="space-y-1">
          {ticket.ticket_status_history.map(h => (
            <div key={h.id} className="text-xs text-gray-600 flex items-center gap-1">
              <span className="text-gray-400">{formatDate(h.created_at)}</span>
              <span>{h.from_status ?? '—'} → {h.to_status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
