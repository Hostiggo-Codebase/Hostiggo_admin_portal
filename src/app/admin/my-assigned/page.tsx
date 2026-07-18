'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getMyAssignedTickets, setAgentPresence, heartbeat } from '@/lib/services/ticketService'
import { StatusBadge } from '@/components/ui/status-badge'
import { useMyAssignments } from '@/hooks/useMyAssignments'
import { useAgentPresence } from '@/hooks/useAgentPresence'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import type { TicketStatus } from '@/types/app'

export default function MyAssignedPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [online, setOnline] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  useAgentPresence(userId)
  useMyAssignments(userId)

  // Heartbeat every 60s
  useEffect(() => {
    const t = setInterval(() => heartbeat(), 60_000)
    return () => clearInterval(t)
  }, [])

  const { data: tickets = [] } = useQuery({
    queryKey: ['my-assigned'],
    queryFn: getMyAssignedTickets,
    enabled: !!userId,
  })

  const { mutate: togglePresence, isPending } = useMutation({
    mutationFn: () => setAgentPresence(online ? 'OFFLINE' : 'ONLINE', !online),
    onSuccess: () => setOnline(v => !v),
  })

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">My Assigned Chats</h1>
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-gray-300'}`} />
          <button
            onClick={() => togglePresence()}
            disabled={isPending}
            className="text-sm border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            {online ? 'Go Offline' : 'Go Online'}
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        {tickets.length}/2 slots used
        {tickets.length >= 2 && <span className="ml-2 text-orange-600 font-medium">· At capacity</span>}
      </p>

      {tickets.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>No active chats.</p>
          {!online && <p className="text-sm mt-1">Go online to receive tickets.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(t => (
            <Link
              key={t.ticket_id}
              href={`/admin/tickets/${t.ticket_id}`}
              className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-gray-400">{t.ticket_number}</span>
                    <StatusBadge status={t.status as TicketStatus} />
                  </div>
                  <p className="font-medium text-sm">{t.subject}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {(t.complaint_categories as { name: string } | null)?.name} · {t.priority_label}
                  </p>
                </div>
                <span className="text-xs text-gray-400">{formatDate(t.assigned_at ?? t.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
