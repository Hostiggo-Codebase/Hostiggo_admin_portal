import { NextRequest, NextResponse } from 'next/server'
import { secondaryClient } from '@/lib/supabase/secondary'

const DEFAULT_CATEGORY_ID = 'ca222222-2222-2222-2222-222222222222'
const ACTIVE_STATUSES = ['QUEUED', 'ASSIGNED', 'ACTIVE', 'WAITING_ON_USER', 'REOPENED']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...corsHeaders,
      ...init?.headers,
    },
  })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const name = String(body.name || body.displayName || 'Hostiggo User').trim()
    const phone = body.phone ? String(body.phone).trim() : null
    const requestedUserId = typeof body.userId === 'string' && UUID_RE.test(body.userId)
      ? body.userId
      : null

    if (!email) {
      return json({ error: 'email is required' }, { status: 400 })
    }

    const usersTable = (secondaryClient as any).schema('hostiggo_testing_schema').from('users')

    let user: any = null
    if (requestedUserId) {
      const { data } = await usersTable
        .select('*')
        .eq('user_id', requestedUserId)
        .maybeSingle()
      user = data
    }

    if (!user) {
      const { data } = await usersTable
        .select('*')
        .eq('email', email)
        .maybeSingle()
      user = data
    }

    if (!user) {
      const insertPayload: Record<string, unknown> = {
        name,
        email,
        phone,
      }
      if (requestedUserId) insertPayload.user_id = requestedUserId

      const { data, error } = await usersTable
        .insert(insertPayload)
        .select()
        .single()

      if (error) throw error
      user = data
    } else {
      const { data } = await usersTable
        .update({ name, phone })
        .eq('user_id', user.user_id)
        .select()
        .maybeSingle()
      if (data) user = data
    }

    const userId = user.user_id

    const { data: activeTicket, error: ticketFetchError } = await secondaryClient
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (ticketFetchError) throw ticketFetchError

    if (activeTicket) {
      return json({
        ticket_id: activeTicket.ticket_id,
        ticket: activeTicket,
        user: {
          id: user.user_id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        },
        created: false,
      })
    }

    const { data: newTicket, error: ticketCreateError } = await secondaryClient
      .from('support_tickets')
      .insert({
        user_id: userId,
        category_id: DEFAULT_CATEGORY_ID,
        subject: 'App Support Chat',
        description: 'Support chat started from the mobile app.',
        priority_label: 'General',
        priority: 3,
        status: 'QUEUED',
      })
      .select()
      .single()

    if (ticketCreateError) throw ticketCreateError

    return json({
      ticket_id: newTicket.ticket_id,
      ticket: newTicket,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      created: true,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Mobile start-chat error:', error)
    return json({ error: error.message || 'Failed to start chat' }, { status: 500 })
  }
}
