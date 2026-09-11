'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  changeStatus, escalateTicket, transferTicket, takeTicket, getAvailableAgents,
} from '@/lib/services/ticketService'
import { StatusBadge } from '@/components/ui/status-badge'
import { SlaBadge } from '@/components/ui/sla-badge'
import { formatDate } from '@/lib/utils'
import type { TicketWithDetails } from '@/types/app'
import { CheckCircle2, RotateCcw, AlertTriangle, ArrowRightLeft, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  ticket: TicketWithDetails
  isSuperAdmin: boolean
}

export function TicketSidePanel({ ticket, isSuperAdmin }: Props) {
  const router = useRouter()
  const [escalateReason, setEscalateReason] = useState('')
  const [showEscalate, setShowEscalate] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferTarget, setTransferTarget] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const qc = useQueryClient()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ticket', ticket.ticket_id] })
    qc.invalidateQueries({ queryKey: ['queue'] })
    router.refresh()
  }

  const takeM = useMutation({ mutationFn: () => takeTicket(ticket.ticket_id), onSuccess: invalidate })
  const resolveM = useMutation({ mutationFn: () => changeStatus(ticket.ticket_id, 'RESOLVED'), onSuccess: invalidate })
  const activeM = useMutation({ mutationFn: () => changeStatus(ticket.ticket_id, 'ACTIVE'), onSuccess: invalidate })
  const waitM = useMutation({ mutationFn: () => changeStatus(ticket.ticket_id, 'WAITING_ON_USER'), onSuccess: invalidate })
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

  const { ticket_id, ticket_number, subject, status, priority_label, created_at, first_response_at, complaint_categories, ticket_status_history = [] } = ticket

  const isQueued = status === 'QUEUED' || status === 'ASSIGNED'
  const isActive = status === 'ACTIVE'
  const isWaiting = status === 'WAITING_ON_USER'
  const isEscalated = status === 'ESCALATED'
  const isDone = status === 'RESOLVED' || status === 'CLOSED'

  return (
    <aside className="w-80 border-l border-gray-200 bg-white flex flex-col h-full overflow-hidden shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-mono font-medium text-gray-400">{ticket_number}</span>
          <StatusBadge status={status} />
        </div>
        <h3 className="font-semibold text-sm text-gray-900 line-clamp-2">{subject}</h3>
      </div>

      {/* Ticket Details */}
      <div className="p-4 space-y-3 text-sm flex-1 overflow-y-auto">
        {/* Customer User Info */}
        <div className="rounded-lg bg-indigo-50/60 border border-indigo-100 p-2.5 text-xs">
          <span className="text-indigo-500 block font-semibold text-[10px] uppercase tracking-wider mb-1">Customer Profile</span>
          <p className="font-semibold text-gray-900 truncate">👤 {(ticket as any).users?.display_name || (ticket as any).users?.name || (ticket as any).user_details?.display_name || 'Customer'}</p>
          {(ticket as any).users?.email || (ticket as any).user_details?.email ? (
            <p className="text-gray-500 text-[11px] truncate">✉️ {(ticket as any).users?.email || (ticket as any).user_details?.email}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-gray-50 p-2.5">
            <span className="text-gray-400 block font-medium mb-0.5">Category</span>
            <p className="font-semibold text-gray-800 truncate">{complaint_categories?.name ?? '—'}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-2.5">
            <span className="text-gray-400 block font-medium mb-0.5">Priority</span>
            <p className="font-semibold text-gray-800 truncate">{priority_label}</p>
          </div>
        </div>

        <div className="space-y-2 text-xs pt-1">
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-400">Created</span>
            <span className="font-medium text-gray-700">{formatDate(created_at)}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-gray-400">SLA Status</span>
            <SlaBadge priorityLabel={priority_label} createdAt={created_at} firstResponseAt={first_response_at} />
          </div>
        </div>

        {/* Workflow actions */}
        <div className="pt-3 border-t border-gray-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Actions</p>
            <span className="text-[10px] text-gray-400">Slot status</span>
          </div>

          {isQueued && (
            <button
              onClick={() => takeM.mutate()}
              disabled={takeM.isPending}
              className="w-full text-xs font-semibold py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              {takeM.isPending ? 'Claiming…' : '⚡ Take Ticket'}
            </button>
          )}

          {isActive && (
            <>
              <button
                onClick={() => resolveM.mutate()}
                disabled={resolveM.isPending}
                className="w-full text-xs font-semibold py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 size={15} /> Mark Complete (Resolved)
              </button>

              <button
                onClick={() => waitM.mutate()}
                disabled={waitM.isPending}
                className="w-full text-xs font-medium py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={14} /> Hold (Wait for User)
              </button>

              <p className="text-[11px] text-gray-500 bg-gray-50 p-2 rounded-md border border-gray-100 leading-tight">
                💡 <em>Completing or Holding releases your slot so you can take another ticket.</em>
              </p>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  onClick={() => { setShowEscalate(v => !v); setShowTransfer(false) }}
                  className="text-xs font-medium py-1.5 border border-red-200 text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <AlertTriangle size={13} /> Escalate
                </button>
                <button
                  onClick={() => { setShowTransfer(v => !v); setShowEscalate(false) }}
                  className="text-xs font-medium py-1.5 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <ArrowRightLeft size={13} /> Transfer
                </button>
              </div>
            </>
          )}

          {isWaiting && (
            <>
              <div className="bg-amber-50 p-2 rounded-md border border-amber-200 text-amber-800 text-[11px]">
                ⏸️ <strong>On Hold</strong> (Waiting for User response). Slot freed.
              </div>
              <button
                onClick={() => resolveM.mutate()}
                disabled={resolveM.isPending}
                className="w-full text-xs font-semibold py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 size={14} /> Mark Complete (Resolved)
              </button>
              <button
                onClick={() => activeM.mutate()}
                disabled={activeM.isPending}
                className="w-full text-xs font-medium py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={14} /> Resume Active Review
              </button>
            </>
          )}

          {isEscalated && isSuperAdmin && (
            <>
              <button
                onClick={() => resolveM.mutate()}
                disabled={resolveM.isPending}
                className="w-full text-xs font-semibold py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 size={14} /> Mark Complete (Resolved)
              </button>
              <button
                onClick={() => activeM.mutate()}
                disabled={activeM.isPending}
                className="w-full text-xs font-medium py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={14} /> Send Back to Agent
              </button>
            </>
          )}

          {isDone && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center space-y-1.5">
              <p className="text-xs font-semibold text-emerald-800">
                {status === 'RESOLVED' ? '✓ Complete / Resolved' : '✓ Closed'}
              </p>
              <button
                onClick={() => activeM.mutate()}
                disabled={activeM.isPending}
                className="text-[11px] font-medium text-emerald-700 underline hover:text-emerald-900"
              >
                Re-open Ticket
              </button>
            </div>
          )}

          {showEscalate && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <textarea
                value={escalateReason}
                onChange={e => setEscalateReason(e.target.value)}
                placeholder="Reason for escalation…"
                rows={2}
                className="w-full border rounded-lg p-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-red-400"
              />
              <button
                onClick={() => escalateM.mutate()}
                disabled={!escalateReason.trim() || escalateM.isPending}
                className="w-full text-xs py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                {escalateM.isPending ? 'Escalating…' : 'Confirm Escalate'}
              </button>
            </div>
          )}

          {showTransfer && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <select
                value={transferTarget}
                onChange={e => setTransferTarget(e.target.value)}
                className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select agent…</option>
                {agents.map(a => (
                  <option key={a.admin_id} value={a.admin_id}>
                    {a.display_name} ({a.active_chat_count})
                  </option>
                ))}
              </select>
              <button
                onClick={() => transferM.mutate()}
                disabled={!transferTarget || transferM.isPending}
                className="w-full text-xs py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
              >
                {transferM.isPending ? 'Transferring…' : 'Confirm Transfer'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status History (collapsible) */}
      <div className="border-t border-gray-200">
        <button
          onClick={() => setShowHistory(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:bg-gray-50"
        >
          History
          {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showHistory && (
          <div className="px-4 pb-3 space-y-1.5 max-h-48 overflow-y-auto">
            {ticket_status_history.length === 0 ? (
              <p className="text-xs text-gray-400">No history yet.</p>
            ) : (
              ticket_status_history.map(h => (
                <div key={h.id} className="text-xs text-gray-600">
                  <span className="text-gray-400 mr-1.5">{formatDate(h.created_at)}</span>
                  <span className="font-medium">{h.from_status ?? '—'} → {h.to_status}</span>
                  {h.note && <p className="text-gray-400 mt-0.5 pl-1 italic">{h.note}</p>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

