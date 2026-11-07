import { createClient } from '@/lib/supabase/server'
import { secondaryClient } from '@/lib/supabase/secondary'
import { NextResponse } from 'next/server'
import { adjustAgentCount } from '@/lib/services/agent-count'
import { getAdminAccess } from '@/lib/auth/admin-access'

// The app project's support_tickets may not have the agent-tracking columns (assigned_agent_id, assigned_at,
// resolved_at). Try the full update, then fall back to the columns every deployment has so status changes
// (and therefore the chat) never break on a missing column.
async function updateSecondaryTicket(ticketId: string, fields: Record<string, unknown>) {
  const full = await secondaryClient.from('support_tickets').update(fields).eq('ticket_id', ticketId)
  if (!full.error) return
  const { status } = fields as { status?: string }
  const minimal = await secondaryClient
    .from('support_tickets')
    .update({ ...(status ? { status } : {}), updated_at: new Date().toISOString() })
    .eq('ticket_id', ticketId)
  if (minimal.error) throw minimal.error
}

export async function POST(request: Request) {
  try {
    const { action, ticketId, newStatus, note, reason, toAgent } = await request.json()
    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const admin = await getAdminAccess(supabase as any, user.id)
    if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    const agentId = user.id
    const isSuperAdmin = admin.role === 'super_admin'

    // Check if ticket exists in secondary database
    let secTicket: any = null
    try {
      const { data } = await secondaryClient
        .from('support_tickets')
        .select('*')
        .eq('ticket_id', ticketId)
        .maybeSingle()
      secTicket = data
    } catch (e) {
      console.log('Secondary DB lookup error:', e)
    }

    if (!secTicket) {
      const { data: localTicket, error: localTicketError } = await (supabase as any)
        .from('support_tickets')
        .select('ticket_id, assigned_agent_id, status')
        .eq('ticket_id', ticketId)
        .maybeSingle()
      if (localTicketError) throw localTicketError
      if (!localTicket && action !== 'take_ticket') {
        return NextResponse.json({ error: 'Ticket not found or access denied' }, { status: 404 })
      }
      if (localTicket?.assigned_agent_id && localTicket.assigned_agent_id !== agentId && !isSuperAdmin) {
        return NextResponse.json({ error: 'This ticket belongs to another admin' }, { status: 403 })
      }
      if (localTicket && action !== 'take_ticket' && !isSuperAdmin && localTicket.assigned_agent_id !== agentId) {
        return NextResponse.json({ error: 'Take this ticket before changing its status' }, { status: 409 })
      }
    }

    if (secTicket) {
      // Handle Secondary DB ticket action
      if (action === 'take_ticket') {
        if (['RESOLVED', 'CLOSED'].includes(secTicket.status)) {
          return NextResponse.json({ error: 'Completed tickets cannot be taken' }, { status: 409 })
        }
        const { data: newlyClaimed, error: claimError } = await (supabase as any)
          .rpc('claim_external_ticket', { p_ticket_id: ticketId })
        if (claimError) {
          if (claimError.message?.includes('TICKET_ALREADY_TAKEN')) {
            return NextResponse.json({ error: 'This ticket was already taken by another admin' }, { status: 409 })
          }
          throw claimError
        }

        // Keep the secondary ticket status useful for the customer app, but
        // store ownership only in the admin portal database.
        if (secTicket.status === 'QUEUED') {
          const { error: statusError } = await secondaryClient
            .from('support_tickets').update({ status: 'ACTIVE' }).eq('ticket_id', ticketId)
          if (statusError) console.error('Ticket claimed but secondary status update failed:', statusError)
        }

        if (newlyClaimed) await adjustAgentCount(supabase as any, agentId, 'increment')
        return NextResponse.json({ success: true, status: secTicket.status === 'QUEUED' ? 'ACTIVE' : secTicket.status, assigned_agent_id: agentId })
      }

      const { data: externalOwner, error: ownerError } = await (supabase as any)
        .rpc('get_external_ticket_owner', { p_ticket_id: ticketId })
      if (ownerError) throw ownerError
      if (externalOwner && externalOwner !== agentId && !isSuperAdmin) {
        return NextResponse.json({ error: 'This ticket belongs to another admin' }, { status: 403 })
      }
      if (!isSuperAdmin && externalOwner !== agentId) {
        return NextResponse.json({ error: 'Take this ticket before changing its status' }, { status: 409 })
      }

      if (action === 'change_status') {
        const updateData: any = { status: newStatus }
        if (newStatus === 'RESOLVED' || newStatus === 'CLOSED') {
          updateData.resolved_at = new Date().toISOString()
        }
        await updateSecondaryTicket(ticketId, updateData)

        // If status moved to non-active state, decrement agent count
        if (agentId && ['RESOLVED', 'CLOSED', 'ESCALATED', 'WAITING_ON_USER'].includes(newStatus)) {
          await adjustAgentCount(supabase as any, agentId, 'decrement')
        }
        return NextResponse.json({ success: true, status: newStatus })
      }

      if (action === 'escalate_ticket') {
        await updateSecondaryTicket(ticketId, { status: 'ESCALATED' })
        return NextResponse.json({ success: true, status: 'ESCALATED' })
      }

      if (action === 'transfer_ticket') {
        const { error } = await (supabase as any).rpc('transfer_external_ticket', {
          p_ticket_id: ticketId,
          p_to_agent: toAgent,
        })
        if (error) throw error
        await updateSecondaryTicket(ticketId, { status: 'ASSIGNED' })
        return NextResponse.json({ success: true, status: 'ASSIGNED' })
      }
    }

    // Local DB execution via RPC
    if (action === 'take_ticket') {
      const { error } = await (supabase as any).rpc('take_ticket', { p_ticket_id: ticketId })
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'change_status') {
      const { error } = await (supabase as any).rpc('change_status', {
        p_ticket_id: ticketId,
        p_new_status: newStatus,
        p_note: note,
      })
      if (error) {
        // Direct update fallback
        await (supabase as any)
          .from('support_tickets')
          .update({ status: newStatus })
          .eq('ticket_id', ticketId)
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'escalate_ticket') {
      const { error } = await (supabase as any).rpc('escalate_ticket', {
        p_ticket_id: ticketId,
        p_reason: reason,
      })
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'transfer_ticket') {
      const { error } = await (supabase as any).rpc('transfer_ticket', {
        p_ticket_id: ticketId,
        p_to_agent: toAgent,
      })
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('API ticket action error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
