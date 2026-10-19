import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { secondaryClient } from '@/lib/supabase/secondary'
import { loadTicket } from '@/lib/services/load-ticket'
import { ChatPane } from '@/components/chat/chat-pane'
import { TicketSidePanel } from '@/components/admin/ticket-side-panel'
import { StatusBadge } from '@/components/ui/status-badge'
import { VideoUpload } from '@/components/video/video-upload'
import type { TicketStatus, TicketWithDetails } from '@/types/app'

export const dynamic = 'force-dynamic'

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const normalizeExternalTicket = (row: Record<string, unknown>): TicketWithDetails => ({
    ...row,
    ticket_number: row.ticket_number || `HG-${id.slice(0, 5)}`,
    complaint_categories: { id: row.category_id || '', name: 'General' },
    ticket_status_history: [],
  } as unknown as TicketWithDetails)

  const ticket = await loadTicket<TicketWithDetails>([
    async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, complaint_categories(id, name), ticket_status_history(id, from_status, to_status, note, created_at, changed_by)')
        .eq('ticket_id', id)
        .abortSignal(AbortSignal.timeout(8_000))
        .maybeSingle()
      if (error) throw error
      return data as TicketWithDetails | null
    },
    async () => {
      const { data, error } = await secondaryClient
        .from('support_tickets')
        .select('*')
        .eq('ticket_id', id)
        .abortSignal(AbortSignal.timeout(8_000))
        .maybeSingle()
      if (error) throw error
      return data ? normalizeExternalTicket(data) : null
    },
  ], async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('fdw_support_tickets')
        .select('*')
        .eq('ticket_id', id)
        .abortSignal(AbortSignal.timeout(8_000))
        .maybeSingle()
      if (error) throw error
      return data ? normalizeExternalTicket(data) : null
    } catch (error) {
      console.error('Ticket bridge lookup failed:', error)
      throw error
    }
  })

  if (!ticket) {
    redirect('/admin/queue')
  }

  const role = user.app_metadata?.role
  const isSA = role === 'super_admin'

  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="border-b bg-white px-4 py-3 flex items-center gap-3">
          <Link href="/admin/queue" className="text-sm text-gray-500 hover:text-black">← Queue</Link>
          <span className="font-mono text-xs text-gray-400">{ticket.ticket_number}</span>
          <StatusBadge status={ticket.status as TicketStatus} />
          <span className="font-semibold text-sm flex-1 truncate">{ticket.subject}</span>
        </div>
        {/* Video evidence (read-only for agents) */}
        <div className="px-4 py-3 border-b bg-white">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Video Evidence</p>
          <VideoUpload ticketId={id} readOnly />
        </div>

        <div className="flex-1 min-h-0">
          <ChatPane
            ticketId={id}
            currentUserId={user.id}
            status={ticket.status as TicketStatus}
            isAgent
            showInternalNoteToggle
          />
        </div>
      </div>

      {/* Side panel */}
      <TicketSidePanel ticket={ticket as unknown as TicketWithDetails} isSuperAdmin={isSA} />
    </div>
  )
}
