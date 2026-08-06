import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('*, complaint_categories(id, name), ticket_status_history(id, from_status, to_status, note, created_at, changed_by)')
    .eq('ticket_id', id)
    .single() as { data: TicketWithDetails | null }

  if (!ticket) redirect('/admin/queue')

  const role = user.app_metadata?.role
  const isSA = role === 'super_admin'

  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="border-b bg-white px-4 py-3 flex items-center gap-3">
          <a href="/admin/queue" className="text-sm text-gray-500 hover:text-black">← Queue</a>
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
