import { createClient } from '@/lib/supabase/server'
import { secondaryClient } from '@/lib/supabase/secondary'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    let fdwTickets: any[] = []
    let localTickets: any[] = []

    // 1. Fetch from FDW view
    try {
      const { data: prodData, error: prodErr } = await (supabase as any)
        .from('fdw_support_tickets')
        .select('*, complaint_categories(name)')

      if (!prodErr && prodData) {
        fdwTickets = prodData
      } else {
        // Fallback without join
        const { data: rawProd } = await (supabase as any)
          .from('fdw_support_tickets')
          .select('*')
        if (rawProd) fdwTickets = rawProd
      }
    } catch (e) {
      console.log('FDW fetch error:', e)
    }

    // Always merge the app project's tickets directly: the FDW view can be stale or down, and a ticket must show
    // up in the queue the moment a customer sends their first message. Deduplicated by ticket_id below.
    {
      try {
        const { data: secondaryTickets, error: secondaryError } = await secondaryClient
          .from('support_tickets')
          .select('*')

        if (secondaryError) {
          console.error('Secondary queue fetch error:', secondaryError.message)
        } else if (secondaryTickets) {
          fdwTickets = [...fdwTickets, ...secondaryTickets]
        }
      } catch (e) {
        console.error('Secondary queue fetch exception:', e)
      }
    }

    // 2. Fetch from local table
    try {
      const { data: localData, error: localErr } = await supabase
        .from('support_tickets')
        .select('ticket_id, ticket_number, subject, status, priority, priority_label, queued_at, assigned_at, first_response_at, created_at, assigned_agent_id, complaint_categories(name)')

      if (!localErr && localData) {
        localTickets = localData
      }
    } catch (e) {
      console.log('Local fetch error:', e)
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

    return NextResponse.json(combined)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
