import { createClient } from '@/lib/supabase/server'
import { secondaryClient } from '@/lib/supabase/secondary'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ticketId = searchParams.get('ticketId')

  if (!ticketId) {
    return NextResponse.json({ error: 'ticketId required' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    // Read the app and local databases together. The FDW bridge can be down
    // even while the app database is healthy; it must not block opening chat.
    const [secondary, local] = await Promise.allSettled([
      secondaryClient
        .from('chat_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
        .abortSignal(AbortSignal.timeout(8_000)),
      supabase
        .from('chat_messages')
        .select('*, message_attachments (*)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
        .abortSignal(AbortSignal.timeout(8_000)),
    ])

    let fdwMsgs: any[] = secondary.status === 'fulfilled' && !secondary.value.error
      ? secondary.value.data ?? [] : []
    const localMsgs: any[] = local.status === 'fulfilled' && !local.value.error
      ? local.value.data ?? [] : []

    // The bridge mirrors the app database. Only use it if the direct read fails.
    if (secondary.status === 'rejected' || secondary.value.error) {
      try {
        const { data, error } = await (supabase as any)
          .from('fdw_chat_messages')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true })
          .abortSignal(AbortSignal.timeout(8_000))
        if (!error && data) fdwMsgs = data
      } catch (error) {
        console.error('Ticket message bridge lookup failed:', error)
      }
    }

    // Combine and deduplicate
    const combinedMap = new Map<string, any>()
    for (const m of [...fdwMsgs, ...localMsgs]) {
      if (m && m.id) combinedMap.set(m.id, m)
    }
    let combined = Array.from(combinedMap.values())

    // If no chat messages found, synthesize the initial ticket description message so Admin Portal always displays the user's issue
    if (combined.length === 0 && ticketId) {
      let ticketData: any = null
      try {
        const { data } = await secondaryClient
          .from('support_tickets')
          .select('*')
          .eq('ticket_id', ticketId)
          .maybeSingle()
        ticketData = data
      } catch (e) {}

      if (!ticketData) {
        try {
          const { data } = await (supabase as any)
            .from('support_tickets')
            .select('*')
            .eq('ticket_id', ticketId)
            .maybeSingle()
          ticketData = data
        } catch (e) {}
      }

      if (ticketData && ticketData.description) {
        const initialMsg = {
          id: `init-${ticketId}`,
          ticket_id: ticketId,
          sender_id: ticketData.user_id || 'user',
          sender_type: 'user',
          body: ticketData.description,
          created_at: ticketData.created_at || new Date().toISOString(),
        }
        combined.push(initialMsg)

        // Persist to Secondary DB chat_messages
        try {
          await secondaryClient.from('chat_messages').insert({
            id: crypto.randomUUID(),
            ticket_id: ticketId,
            sender_id: ticketData.user_id || '11111111-1111-1111-1111-111111111111',
            sender_type: 'user',
            body: ticketData.description,
          })
        } catch (e) {}
      }
    }

    combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    return NextResponse.json(combined)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { ticketId, body, isInternalNote } = await request.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const agentId = user?.id || '00000000-0000-0000-0000-000000000000'

    // 1. Try Secondary Supabase DB direct insert (for mobile app tickets)
    try {
      const { data: secMsg, error: secErr } = await secondaryClient
        .from('chat_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: agentId,
          sender_type: 'agent',
          body: body,
          is_internal_note: isInternalNote ?? false,
        })
        .select()
        .single()

      if (!secErr && secMsg) {
        return NextResponse.json({ success: true, messageId: secMsg.id, message: secMsg })
      }
    } catch (e) {
      console.log('Secondary DB msg send error:', e)
    }

    // 2. Fallback to local RPC send_message
    const { data: rpcMessageId, error } = await (supabase as any).rpc('send_message', {
      p_ticket_id: ticketId,
      p_body: body,
      p_is_internal_note: isInternalNote ?? false,
    })

    if (error) {
      // 3. Direct insert into local chat_messages
      const { data: localMsg } = await (supabase as any)
        .from('chat_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: agentId,
          sender_type: 'agent',
          body: body,
          is_internal_note: isInternalNote ?? false,
        })
        .select()
        .single()

      if (localMsg) {
        return NextResponse.json({ success: true, messageId: (localMsg as any).id, message: localMsg })
      }
      throw error
    }

    const synthesizedRpcMsg = {
      id: rpcMessageId || crypto.randomUUID(),
      ticket_id: ticketId,
      sender_id: agentId,
      sender_type: 'agent',
      body: body,
      is_internal_note: isInternalNote ?? false,
      created_at: new Date().toISOString(),
    }

    return NextResponse.json({ success: true, messageId: rpcMessageId, message: synthesizedRpcMsg })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
