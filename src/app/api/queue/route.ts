import { createClient } from '@/lib/supabase/server'
import { secondaryClient } from '@/lib/supabase/secondary'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET() {
  try {
    const supabase = await createClient()

    // Read both databases concurrently; the FDW bridge can be unavailable
    // while the app database is healthy and should not block live queue updates.
    const [secondary, local] = await Promise.allSettled([
      secondaryClient.from('support_tickets').select('*')
        .abortSignal(AbortSignal.timeout(8_000)),
      supabase.from('support_tickets')
        .select('ticket_id, ticket_number, subject, status, priority, priority_label, queued_at, assigned_at, first_response_at, created_at, assigned_agent_id, complaint_categories(name)')
        .abortSignal(AbortSignal.timeout(8_000)),
    ])
    let fdwTickets: any[] = secondary.status === 'fulfilled' && !secondary.value.error
      ? secondary.value.data ?? [] : []
    const localTickets: any[] = local.status === 'fulfilled' && !local.value.error
      ? local.value.data ?? [] : []

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
        combinedMap.set(id, {
          ...t,
          ticket_id: id,
          ticket_number: t.ticket_number || `HG-${id.slice(0, 5)}`,
          status: t.status || 'QUEUED',
          priority_label: t.priority_label || 'General',
          priority: t.priority || 3,
          created_at: t.created_at || new Date().toISOString(),
        })
      }
    }

    const combined = Array.from(combinedMap.values())
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
