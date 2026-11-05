import { createClient } from '@/lib/supabase/server'
import { secondaryClient } from '@/lib/supabase/secondary'
import { NextResponse } from 'next/server'
import { getAdminAccess } from '@/lib/auth/admin-access'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const admin = await getAdminAccess(supabase as any, user.id)
    if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    const isSuperAdmin = admin.role === 'super_admin'
    const { data: externalAssignments, error: assignmentError } = await (supabase as any)
      .rpc('get_external_ticket_assignments')
    if (assignmentError) {
      console.error('External ticket assignments lookup failed:', assignmentError)
      return NextResponse.json({ error: 'Ticket assignment migration is not available yet' }, { status: 503 })
    }
    const externalOwners = new Map<string, string>(
      (externalAssignments ?? []).map((assignment: any) => [assignment.ticket_id, assignment.assigned_agent_id]),
    )

    // Read both databases concurrently; the FDW bridge can be unavailable
    // while the app database is healthy and should not block live queue updates.
    const [secondary, local] = await Promise.allSettled([
      secondaryClient.from('support_tickets').select('*')
        .abortSignal(AbortSignal.timeout(8_000)),
      (supabase as any).rpc('get_admin_queue_tickets')
        .abortSignal(AbortSignal.timeout(8_000)),
    ])
    if (local.status === 'rejected' || local.value.error) {
      const error = local.status === 'rejected' ? local.reason : local.value.error
      console.error('Admin queue summary lookup failed:', error)
      return NextResponse.json({ error: 'Primary admin queue migration is not available yet' }, { status: 503 })
    }
    let fdwTickets: any[] = secondary.status === 'fulfilled' && !secondary.value.error
      ? secondary.value.data ?? [] : []
    const localTickets: any[] = (local.value.data ?? []).map((ticket: any) => ({
          ...ticket,
          complaint_categories: ticket.category_name ? { name: ticket.category_name } : null,
        }))

    if (secondary.status === 'rejected' || secondary.value.error) {
      try {
        const { data, error } = await (supabase as any)
          .from('fdw_support_tickets')
          .select('*')
          .abortSignal(AbortSignal.timeout(8_000))
        if (error) throw error
        fdwTickets = data ?? []
      } catch (error) {
        console.error('Queue bridge lookup failed:', error)
      }
    }

    // 3. Combine both lists (Deduplicate by ticket_id)
    const combinedMap = new Map<string, any>()
    for (const t of [...fdwTickets, ...localTickets]) {
      if (t && (t.ticket_id || t.id)) {
        const id = t.ticket_id || t.id
        const previous = combinedMap.get(id)
        combinedMap.set(id, {
          ...(previous || {}),
          ...t,
          // A mirror can lag behind the source. Never lose an existing owner
          // when duplicate rows from the two databases are combined.
          assigned_agent_id: t.assigned_agent_id || previous?.assigned_agent_id || null,
          ticket_id: id,
          subject: t.subject || 'Customer support request',
          ticket_number: t.ticket_number || `HG-${id.slice(0, 5)}`,
          status: t.status || 'QUEUED',
          priority_label: t.priority_label || 'General',
          priority: t.priority || 3,
          created_at: t.created_at || new Date().toISOString(),
        })
      }
    }

    const combined = Array.from(combinedMap.values()).map((ticket) => {
      const isTerminal = ['RESOLVED', 'CLOSED'].includes(ticket.status)
      const assignedAgentId = ticket.assigned_agent_id || externalOwners.get(ticket.ticket_id) || null
      // Legacy tickets can have ACTIVE/ASSIGNED/etc. status but no owner.
      // Ownership, not the historic status label, determines whether they
      // are still available to claim.
      const canTake = !isSuperAdmin && !assignedAgentId && !isTerminal
      const canOpen = isSuperAdmin || assignedAgentId === user.id
      return { ...ticket, assigned_agent_id: assignedAgentId, canTake, canOpen, isAssignedToCurrentAdmin: assignedAgentId === user.id }
    })
    combined.sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3))

    return NextResponse.json(combined, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    )
  }
}
