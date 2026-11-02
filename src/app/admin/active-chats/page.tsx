'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessagesSquare, Search } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { getSocket } from '@/hooks/useTicketChat'
import { timeAgo } from '@/lib/utils'
import type { ActiveChatRow } from '@/lib/services/active-chats'
import type { TicketStatus } from '@/types/app'

async function fetchActiveChats(signal?: AbortSignal): Promise<ActiveChatRow[]> {
  const res = await fetch(`/api/active-chats?t=${Date.now()}`, { cache: 'no-store', signal })
  if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`)
  const data = await res.json()
  if (!Array.isArray(data)) throw new Error('Unexpected response')
  return data
}

export default function ActiveChatsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [adminFilter, setAdminFilter] = useState('')

  const { data: chats = [], isLoading, isError } = useQuery({
    queryKey: ['active-chats'],
    queryFn: ({ signal }) => fetchActiveChats(signal),
    refetchInterval: 5_000,
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  // Same live-refresh channel as the queue; polling above covers socket outages.
  useEffect(() => {
    const socket = getSocket()
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: ['active-chats'] }, { cancelRefetch: false })
    }
    const join = () => {
      socket.emit('join_agents')
      refresh()
    }
    socket.on('connect', join)
    socket.on('queue_updated', refresh)
    socket.on('global_chat_activity', refresh)
    if (socket.connected) join()
    else socket.connect()
    return () => {
      socket.off('connect', join)
      socket.off('queue_updated', refresh)
      socket.off('global_chat_activity', refresh)
    }
  }, [qc])

  const admins = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    for (const c of chats) {
      const entry = map.get(c.admin.id) ?? { name: c.admin.name, count: 0 }
      entry.count += 1
      map.set(c.admin.id, entry)
    }
    return Array.from(map, ([id, v]) => ({ id, ...v })).sort((a, b) => a.name.localeCompare(b.name))
  }, [chats])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return chats.filter(c => {
      if (adminFilter && c.admin.id !== adminFilter) return false
      if (!q) return true
      return [c.ticket_number, c.subject, c.customer.name, c.customer.email, c.admin.name]
        .some(v => v?.toLowerCase().includes(q))
    })
  }, [chats, search, adminFilter])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b bg-white px-5 py-3 flex items-center gap-3 shrink-0">
        <div className="flex-1">
          <h1 className="text-base font-semibold text-gray-900">Active Chats</h1>
          <p className="text-xs text-gray-500">
            {chats.length} open {chats.length === 1 ? 'chat' : 'chats'} · {admins.length} {admins.length === 1 ? 'admin' : 'admins'}
          </p>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer, admin, ticket…"
            className="border border-gray-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-gray-700 bg-white w-64"
          />
        </div>

        <select
          value={adminFilter}
          onChange={e => setAdminFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 bg-white"
        >
          <option value="">All admins</option>
          {admins.map(a => <option key={a.id} value={a.id}>{a.name} ({a.count})</option>)}
        </select>
      </div>

      {isError && (
        <p role="status" className="border-b bg-amber-50 px-5 py-2 text-xs text-amber-800">
          Unable to update chats. Retrying automatically…
        </p>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-sm text-gray-400 gap-2">
            <MessagesSquare size={28} className="text-gray-300" />
            <p>{chats.length === 0 ? 'No open chats' : 'No chats match these filters'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b">
              <tr>
                {['Customer', 'Assigned admin', 'Chat', 'Status', 'Last activity', 'Opened', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.ticket_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.customer.name}</p>
                    {c.customer.email && <p className="text-xs text-gray-400 mt-0.5">{c.customer.email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-900">{c.admin.name}</span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="truncate text-gray-900">{c.subject}</p>
                    <p className="font-mono text-xs text-gray-400 mt-0.5">{c.ticket_number} · {c.priority_label}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={c.status as TicketStatus} /></td>
                  <td className="px-4 py-3 text-xs text-gray-400">{timeAgo(c.last_activity_at)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{timeAgo(c.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/tickets/${c.ticket_id}`}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
                      Open →
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
