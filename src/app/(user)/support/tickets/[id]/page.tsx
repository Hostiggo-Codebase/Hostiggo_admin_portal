import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatPane } from '@/components/chat/chat-pane'
import { StatusBadge } from '@/components/ui/status-badge'
import { RatingPrompt } from '@/components/tickets/rating-prompt'
import { ReopenButton } from './reopen-button'
import { VideoUpload } from '@/components/video/video-upload'
import { formatDate } from '@/lib/utils'
import type { TicketStatus } from '@/types/app'

export const dynamic = 'force-dynamic'

export default async function UserTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  type TicketRow = {
    ticket_id: string; ticket_number: string | null; subject: string; status: string
    priority_label: string; created_at: string; rating: number | null
    reopen_window_expires_at: string | null
    complaint_categories: { name: string } | null
    ticket_status_history: { from_status: string | null; to_status: string; created_at: string }[]
  }
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('*, complaint_categories(name), ticket_status_history(from_status, to_status, created_at)')
    .eq('ticket_id', id)
    .eq('user_id', user.id)
    .single() as { data: TicketRow | null }

  if (!ticket) redirect('/support')

  const status = ticket.status as TicketStatus
  const canReopen = (status === 'RESOLVED' || status === 'CLOSED')
    && ticket.reopen_window_expires_at
    && new Date() < new Date(ticket.reopen_window_expires_at)

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-400">{ticket.ticket_number}</span>
            <StatusBadge status={status} />
          </div>
          <h1 className="font-semibold text-sm mt-0.5">{ticket.subject}</h1>
          <p className="text-xs text-gray-500">
            {(ticket.complaint_categories as { name: string } | null)?.name} · {ticket.priority_label} · {formatDate(ticket.created_at)}
          </p>
        </div>
        <a href="/support" className="text-sm text-gray-500 hover:text-black">← My Tickets</a>
      </div>

      {/* Rating prompt for resolved tickets */}
      {(status === 'RESOLVED' || status === 'CLOSED') && (
        <div className="px-4 py-3 border-b bg-gray-50">
          <RatingPrompt ticketId={id} existingRating={ticket.rating} />
        </div>
      )}

      {/* Reopen */}
      {canReopen && (
        <div className="px-4 py-2 border-b bg-yellow-50">
          <ReopenButton
            ticketId={id}
            reopenWindowExpiresAt={ticket.reopen_window_expires_at!}
          />
        </div>
      )}

      {/* Video evidence */}
      <div className="px-4 py-3 border-b bg-white">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Video Evidence</p>
        <VideoUpload ticketId={id} readOnly={status === 'CLOSED'} />
      </div>

      {/* Chat */}
      <div className="flex-1 min-h-0">
        <ChatPane
          ticketId={id}
          currentUserId={user.id}
          status={status}
        />
      </div>
    </div>
  )
}
