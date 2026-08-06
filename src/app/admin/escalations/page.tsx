'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEscalatedTickets, resolveEscalation } from '@/lib/services/ticketService'
import { timeAgo } from '@/lib/utils'

export default function EscalationsPage() {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const qc = useQueryClient()

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['escalations'],
    queryFn: getEscalatedTickets,
    refetchInterval: 30_000,
  })

  function useResolve(ticketId: string, decision: 'REFUND_APPROVED' | 'REFUND_REJECTED' | 'SEND_BACK') {
    return useMutation({
      mutationFn: () => resolveEscalation(ticketId, decision, notes[ticketId]),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['escalations'] }),
    })
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-6">Escalations</h1>

      {isLoading && <p className="text-gray-400">Loading…</p>}
      {!isLoading && tickets.length === 0 && (
        <p className="text-gray-400 py-16 text-center">No pending escalations</p>
      )}

      <div className="space-y-4">
        {tickets.map(t => (
          <EscalationCard
            key={t.ticket_id}
            ticket={t}
            note={notes[t.ticket_id] ?? ''}
            setNote={v => setNotes(n => ({ ...n, [t.ticket_id]: v }))}
          />
        ))}
      </div>
    </div>
  )
}

function EscalationCard({
  ticket,
  note,
  setNote,
}: {
  ticket: {
    ticket_id: string
    ticket_number: string | null
    subject: string
    priority_label: string
    escalated_at: string | null
    complaint_categories: { name: string } | null
  }
  note: string
  setNote: (v: string) => void
}) {
  const qc = useQueryClient()

  const resolve = (decision: 'REFUND_APPROVED' | 'REFUND_REJECTED' | 'SEND_BACK') =>
    useMutation({
      mutationFn: () => resolveEscalation(ticket.ticket_id, decision, note),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['escalations'] }),
    })

  const approveM  = resolve('REFUND_APPROVED')
  const rejectM   = resolve('REFUND_REJECTED')
  const sendBackM = resolve('SEND_BACK')

  return (
    <div className="bg-white border border-red-200 rounded-lg p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-gray-400">{ticket.ticket_number}</span>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">ESCALATED</span>
            <span className="text-xs text-gray-500">{ticket.priority_label}</span>
          </div>
          <p className="font-medium">{ticket.subject}</p>
          <p className="text-sm text-gray-500">
            {(ticket.complaint_categories)?.name} · escalated {timeAgo(ticket.escalated_at ?? '')}
          </p>
        </div>
        <Link href={`/admin/tickets/${ticket.ticket_id}`}
          className="text-sm text-blue-600 hover:underline">
          View chat →
        </Link>
      </div>

      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Resolution note (optional)…"
        rows={2}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-black"
      />

      <div className="flex gap-2">
        <button
          onClick={() => approveM.mutate()}
          disabled={approveM.isPending}
          className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          Approve Refund
        </button>
        <button
          onClick={() => rejectM.mutate()}
          disabled={rejectM.isPending}
          className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
        >
          Reject Refund
        </button>
        <button
          onClick={() => sendBackM.mutate()}
          disabled={sendBackM.isPending}
          className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Send Back to Agent
        </button>
      </div>
    </div>
  )
}
