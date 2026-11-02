import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { secondaryClient } from '@/lib/supabase/secondary'
import { getAdminAccess } from '@/lib/auth/admin-access'
import {
  OPEN_STATUSES,
  buildActiveChats,
  type PersonInfo,
  type RawTicket,
} from '@/lib/services/active-chats'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
const timeout = () => AbortSignal.timeout(8_000)

type UserRow = { id: string; name?: string | null; display_name?: string | null; email?: string | null }

function toPeople(rows: UserRow[] | null | undefined, into: Map<string, PersonInfo>) {
  for (const row of rows ?? []) {
    const name = (row.name || row.display_name || '').trim()
    if (row.id && (name || row.email)) into.set(row.id, { name: name || row.email!, email: row.email ?? null })
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  if (!(await getAdminAccess(supabase as unknown as Parameters<typeof getAdminAccess>[0], user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE })
  }

  // RLS lets an agent see only their own and queued tickets (and only their own
  // admin_users row). This page is a read-only overview of every open chat, so
  // read with the service role when it is configured.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const service = url && serviceKey
    ? createServiceClient(url, serviceKey, { auth: { persistSession: false } })
    : null
  const db = (service ?? supabase) as typeof supabase

  try {
    // Either database can be unavailable without blocking the other (same as /api/queue).
    const [secondary, local] = await Promise.allSettled([
      secondaryClient.from('support_tickets').select('*').in('status', [...OPEN_STATUSES])
        .abortSignal(timeout()),
      db.from('support_tickets').select('*').in('status', [...OPEN_STATUSES])
        .abortSignal(timeout()),
    ])
    let bridged: RawTicket[] = secondary.status === 'fulfilled' && !secondary.value.error
      ? secondary.value.data ?? [] : []
    const localTickets: RawTicket[] = local.status === 'fulfilled' && !local.value.error
      ? local.value.data ?? [] : []

    if (secondary.status === 'rejected' || secondary.value.error) {
      try {
        const { data, error } = await (supabase as any).from('fdw_support_tickets').select('*')
          .in('status', [...OPEN_STATUSES]).abortSignal(timeout())
        if (error) throw error
        bridged = data ?? []
      } catch (error) {
        console.error('Active chats bridge lookup failed:', error)
      }
    }

    // Local rows win over mobile-app rows with the same id, matching /api/queue.
    const tickets = [...bridged, ...localTickets]
    const customerIds = Array.from(new Set(tickets.map(t => t.user_id).filter((v): v is string => !!v)))
    const adminIds = Array.from(new Set(tickets.map(t => t.assigned_agent_id).filter((v): v is string => !!v)))

    const customers = new Map<string, PersonInfo>()
    const admins = new Map<string, PersonInfo>()

    await Promise.all([
      (async () => {
        if (!customerIds.length) return
        // The users table shape differs between projects; fall back to id + email
        // (shown as the customer name) when the name columns don't exist.
        const lookup = (columns: string) => secondaryClient.from('users').select(columns)
          .in('id', customerIds).abortSignal(timeout())
        let users = await lookup('id, name, display_name, email')
        if (users.error) users = await lookup('id, email')
        toPeople(users.data as unknown as UserRow[] | null, customers)
        const missing = customerIds.filter(id => !customers.has(id))
        if (!missing.length) return
        const { data: bridgedUsers } = await (supabase as any).from('fdw_users')
          .select('id, name, display_name, email').in('id', missing).abortSignal(timeout())
        toPeople(bridgedUsers as UserRow[] | null, customers)

        // Customers are auth users in some projects: name lives in user_metadata.
        if (!service) return
        await Promise.all(missing.filter(id => !customers.has(id)).map(async id => {
          const { data } = await service.auth.admin.getUserById(id)
          const u = data?.user
          if (!u) return
          const meta = u.user_metadata ?? {}
          const name = String(meta.full_name || meta.name || '').trim()
          if (name || u.email) customers.set(id, { name: name || u.email!, email: u.email ?? null })
        }))
      })().catch(error => console.error('Active chats customer lookup failed:', error)),
      (async () => {
        if (!adminIds.length) return
        const { data, error } = await (db as any).from('admin_users')
          .select('admin_id, display_name').in('admin_id', adminIds).abortSignal(timeout())
        if (error) throw error
        for (const row of (data ?? []) as { admin_id: string; display_name: string }[]) admins.set(row.admin_id, { name: row.display_name, email: null })
      })().catch(error => console.error('Active chats admin lookup failed:', error)),
    ])

    return NextResponse.json(buildActiveChats(tickets, customers, admins), { headers: NO_STORE })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load active chats' },
      { status: 500, headers: NO_STORE },
    )
  }
}
