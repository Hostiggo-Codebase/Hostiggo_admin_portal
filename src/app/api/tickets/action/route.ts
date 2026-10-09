import { createClient } from '@/lib/supabase/server'
import { secondaryClient } from '@/lib/supabase/secondary'
import { NextResponse } from 'next/server'

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
    const agentId = user?.id

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

    if (secTicket) {
      // Handle Secondary DB ticket action
      if (action === 'take_ticket') {
        await updateSecondaryTicket(ticketId, {
          status: 'ACTIVE',
          assigned_agent_id: agentId || null,
          assigned_at: new Date().toISOString(),
        })

        if (agentId) {
          await (supabase as any)
            .rpc('increment_agent_count', { p_agent_id: agentId })
            .catch(() => {})
        }
        return NextResponse.json({ success: true, status: 'ACTIVE' })
      }

      if (action === 'change_status') {
        const updateData: any = { status: newStatus }
        if (newStatus === 'RESOLVED' || newStatus === 'CLOSED') {
          updateData.resolved_at = new Date().toISOString()
        }
        await updateSecondaryTicket(ticketId, updateData)

        // If status moved to non-active state, decrement agent count
        if (agentId && ['RESOLVED', 'CLOSED', 'ESCALATED', 'WAITING_ON_USER'].includes(newStatus)) {
          await (supabase as any)
            .rpc('decrement_agent_count', { p_agent_id: agentId })
            .catch(() => {})
        }
        return NextResponse.json({ success: true, status: newStatus })
      }

      if (action === 'escalate_ticket') {
        await updateSecondaryTicket(ticketId, { status: 'ESCALATED' })
        return NextResponse.json({ success: true, status: 'ESCALATED' })
      }

      if (action === 'transfer_ticket') {
        await updateSecondaryTicket(ticketId, { assigned_agent_id: toAgent, status: 'ASSIGNED' })
        return NextResponse.json({ success: true, status: 'ASSIGNED' })
      }
    }

    // Local DB execution via RPC
    if (action === 'take_ticket') {
      const { error } = await (supabase as any).rpc('take_ticket', { p_ticket_id: ticketId })
      if (error) {
        // Direct update fallback if RPC fails
        await (supabase as any)
          .from('support_tickets')
          .update({ status: 'ACTIVE', assigned_agent_id: agentId })
          .eq('ticket_id', ticketId)
      }
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
