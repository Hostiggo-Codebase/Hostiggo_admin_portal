/**
 * Seeds test data for the Active Chats page (/admin/active-chats).
 *
 * Creates (idempotently, with fixed IDs):
 *   6 test customers, 10 tickets across open and closed statuses (+ messages)
 *
 * Two modes:
 *   Full   (SUPABASE_SERVICE_ROLE_KEY set): creates 3 test admins (auth user +
 *          admin_users row) and 6 customers as auth users (name in user_metadata).
 *   Simple (no service key): creates NO auth users. Chats are assigned to
 *          SEED_ADMIN_ID (your own auth user id) plus 2 placeholder admin ids,
 *          which the page shows as "Admin 5eedad00". Without the service key
 *          the page can only resolve your own admin name.
 *
 * Expected on the page: 8 open chats (6 assigned to a test admin, 1 queued/
 * unassigned, 1 escalated). The RESOLVED and CLOSED tickets must NOT appear.
 *
 * Usage (credentials come from .env.local):
 *   npx tsx --env-file=.env.local scripts/seed-active-chats.ts
 *   npx tsx --env-file=.env.local scripts/seed-active-chats.ts --cleanup
 *
 * Required env:
 *   SECONDARY_SUPABASE_URL, SECONDARY_SUPABASE_ANON_KEY (tables allow public
 *     read/write per migration 0014)
 * Full mode also: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Simple mode optional: SEED_ADMIN_ID=<your auth.users id>
 *
 * Requires migration 0017 on the secondary project (assigned_agent_id etc.).
 */
import { createClient } from '@supabase/supabase-js'

const CLEANUP = process.argv.includes('--cleanup')

function need(name: string): string {
  const v = process.env[name]
  if (!v || v.includes('<')) {
    console.error(`Missing ${name} — set it in .env.local`)
    process.exit(1)
  }
  return v
}

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const primary = serviceKey && !serviceKey.includes('<')
  ? createClient(need('NEXT_PUBLIC_SUPABASE_URL'), serviceKey, { auth: { persistSession: false } })
  : null
// When both databases are the same project, writes need the service key (RLS blocks anon).
const secondaryUrl = need('SECONDARY_SUPABASE_URL')
const sameProject = !!primary && secondaryUrl === process.env.NEXT_PUBLIC_SUPABASE_URL
const secondary = createClient(secondaryUrl, sameProject ? serviceKey! : need('SECONDARY_SUPABASE_ANON_KEY'), {
  auth: { persistSession: false },
})

const TEST_DOMAIN = 'seed.hostiggo.test'

const ADMINS = [
  { email: `riya.admin@${TEST_DOMAIN}`,  name: 'Riya Sharma (test)' },
  { email: `karan.admin@${TEST_DOMAIN}`, name: 'Karan Mehta (test)' },
  { email: `neha.admin@${TEST_DOMAIN}`,  name: 'Neha Iyer (test)' },
]

const CUSTOMERS = [
  { user_id: '5eed0000-0000-4000-8000-000000000001', name: 'Asha Rao',      email: `asha.rao@${TEST_DOMAIN}`,    phone: '+91 98100 00001' },
  { user_id: '5eed0000-0000-4000-8000-000000000002', name: 'Vikram Singh',  email: `vikram.singh@${TEST_DOMAIN}`, phone: '+91 98100 00002' },
  { user_id: '5eed0000-0000-4000-8000-000000000003', name: 'Meera Nair',    email: `meera.nair@${TEST_DOMAIN}`,   phone: '+91 98100 00003' },
  { user_id: '5eed0000-0000-4000-8000-000000000004', name: 'Rohan Gupta',   email: `rohan.gupta@${TEST_DOMAIN}`,  phone: '+91 98100 00004' },
  { user_id: '5eed0000-0000-4000-8000-000000000005', name: 'Sana Khan',     email: `sana.khan@${TEST_DOMAIN}`,    phone: '+91 98100 00005' },
  { user_id: '5eed0000-0000-4000-8000-000000000006', name: 'Dev Patel',     email: `dev.patel@${TEST_DOMAIN}`,    phone: '+91 98100 00006' },
]

// Category names; ids are looked up at seed time (they differ per project).
const CAT = { payment: 'Payment', booking: 'Booking', property: 'Property', refund: 'Refund' } as const

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
const tid = (n: number) => `5eed1000-0000-4000-8000-${String(n).padStart(12, '0')}`

// admin: index into ADMINS, or null for unassigned
const TICKETS = [
  { n: 1,  cust: 0, admin: 0,    status: 'ACTIVE',          prio: 1, label: 'Urgent',         cat: CAT.property, age: 45,  subject: 'AC not working in booked villa',        msg: 'The AC in our villa has stopped and it is 38°C outside.' },
  { n: 2,  cust: 1, admin: 0,    status: 'WAITING_ON_USER', prio: 2, label: 'Payment-Refund', cat: CAT.payment,  age: 130, subject: 'Charged twice for the same booking',    msg: 'I see two debits of ₹8,400 for booking #4471.' },
  { n: 3,  cust: 2, admin: 1,    status: 'ACTIVE',          prio: 3, label: 'Booking Help',   cat: CAT.booking,  age: 25,  subject: 'Need to change check-in date',          msg: 'Can I move my check-in from the 12th to the 14th?' },
  { n: 4,  cust: 3, admin: 1,    status: 'ASSIGNED',        prio: 3, label: 'Booking Help',   cat: CAT.booking,  age: 8,   subject: 'Host has not shared key location',      msg: 'I am at the property but cannot find the key box.' },
  { n: 5,  cust: 4, admin: 2,    status: 'ACTIVE',          prio: 2, label: 'Payment-Refund', cat: CAT.refund,   age: 300, subject: 'Security deposit not refunded',         msg: 'It has been 10 days since checkout and no deposit refund.' },
  { n: 6,  cust: 5, admin: 2,    status: 'REOPENED',        prio: 4, label: 'General',        cat: CAT.property, age: 1500, subject: 'Follow-up on noisy neighbours report', msg: 'The issue came back last night, reopening my complaint.' },
  { n: 7,  cust: 0, admin: null, status: 'QUEUED',          prio: 4, label: 'General',        cat: CAT.booking,  age: 3,   subject: 'Question about cancellation policy',    msg: 'Hi, what is the cancellation policy for monthly stays?' },
  { n: 8,  cust: 1, admin: 1,    status: 'ESCALATED',       prio: 1, label: 'Urgent',         cat: CAT.property, age: 600, subject: 'Safety concern: gas smell in property', msg: 'There is a strong gas smell in the kitchen, we left the house.' },
  // Closed work — must NOT show up on the Active Chats page.
  { n: 9,  cust: 2, admin: 0,    status: 'RESOLVED',        prio: 3, label: 'Booking Help',   cat: CAT.booking,  age: 4000, subject: 'Invoice copy request (resolved)',       msg: 'Please send me the GST invoice.' },
  { n: 10, cust: 3, admin: 2,    status: 'CLOSED',          prio: 4, label: 'General',        cat: CAT.refund,   age: 9000, subject: 'Old refund query (closed)',             msg: 'Thanks, refund received.' },
] as const

const PLACEHOLDER_ADMIN_IDS = [
  '5eedad00-0000-4000-8000-000000000001',
  '5eedad00-0000-4000-8000-000000000002',
  '5eedad00-0000-4000-8000-000000000003',
]

async function ensureAdmins(): Promise<string[]> {
  if (!primary) {
    const own = process.env.SEED_ADMIN_ID
    console.log(own
      ? '• Simple mode: assigning chats to SEED_ADMIN_ID + 2 placeholder admins'
      : '• Simple mode: SEED_ADMIN_ID not set, using placeholder admin ids only')
    return own ? [own, ...PLACEHOLDER_ADMIN_IDS.slice(1)] : PLACEHOLDER_ADMIN_IDS
  }
  const ids: string[] = []
  const { data: existing } = await primary.auth.admin.listUsers({ perPage: 1000 })
  for (const a of ADMINS) {
    let id = existing?.users.find(u => u.email === a.email)?.id
    if (!id) {
      const { data, error } = await primary.auth.admin.createUser({
        email: a.email, email_confirm: true, user_metadata: { full_name: a.name },
      })
      if (error || !data.user) throw new Error(`createUser ${a.email}: ${error?.message}`)
      id = data.user.id
    }
    const { error } = await primary.from('admin_users').upsert(
      { admin_id: id, display_name: a.name, role: 'ADMIN', agent_status: 'ONLINE', accepting_new_chats: true },
      { onConflict: 'admin_id' },
    )
    if (error) throw new Error(`admin_users ${a.email}: ${error.message}`)
    ids.push(id)
  }
  return ids
}

async function ensureCustomers(): Promise<string[]> {
  if (primary) {
    // support_tickets.user_id references auth.users, so customers are auth users
    // with their name in user_metadata.
    const { data: existing } = await primary.auth.admin.listUsers({ perPage: 1000 })
    const ids: string[] = []
    for (const c of CUSTOMERS) {
      let id = existing?.users.find(u => u.email === c.email)?.id
      if (!id) {
        const { data, error } = await primary.auth.admin.createUser({
          email: c.email, email_confirm: true, user_metadata: { full_name: c.name },
        })
        if (error || !data.user) throw new Error(`createUser ${c.email}: ${error?.message}`)
        id = data.user.id
      }
      ids.push(id)
    }
    return ids
  }

  // Simple mode: the users table differs between projects (migration 0014 shape
  // vs. id/email only). Best effort; tickets need a matching foreign-key target.
  const full = await secondary.from('users').upsert(
    CUSTOMERS.map(({ user_id, name, email, phone }) => ({ user_id, name, email, phone })),
    { onConflict: 'user_id' },
  )
  if (full.error) console.warn(`! customers not seeded (${full.error.message}); ticket insert may fail`)
  return CUSTOMERS.map(c => c.user_id)
}

async function seed() {
  const adminIds = await ensureAdmins()
  const customerIds = await ensureCustomers()
  if (primary) console.log(`✓ ${adminIds.length} test admins and ${customerIds.length} test customers (auth users)`)

  const { data: cats, error: catErr } = await secondary.from('complaint_categories').select('id, name')
  if (catErr) throw new Error(`complaint_categories: ${catErr.message}`)
  const catId = (name: string) => {
    const id = cats?.find(c => c.name === name)?.id ?? cats?.[0]?.id
    if (!id) throw new Error('No complaint_categories rows exist; add one first')
    return id
  }

  const tickets = TICKETS.map(t => ({
    ticket_id: tid(t.n),
    ticket_number: `HG-T${String(t.n).padStart(4, '0')}`,
    user_id: customerIds[t.cust],
    category_id: catId(t.cat),
    subject: t.subject,
    description: t.msg,
    status: t.status,
    priority: t.prio,
    priority_label: t.label,
    assigned_agent_id: t.admin === null ? null : adminIds[t.admin],
    assigned_at: t.admin === null ? null : minsAgo(Math.max(t.age - 2, 1)),
    queued_at: minsAgo(t.age),
    created_at: minsAgo(t.age),
    updated_at: minsAgo(Math.max(Math.floor(t.age / 4), 1)),
  }))
  const { error: ticketErr } = await secondary.from('support_tickets').upsert(tickets, { onConflict: 'ticket_id' })
  if (ticketErr) throw new Error(`support_tickets: ${ticketErr.message} (is migration 0017 applied?)`)
  console.log(`✓ ${tickets.length} test tickets in secondary`)

  const messages = TICKETS.flatMap(t => [{
    id: `5eed2000-0000-4000-8000-${String(t.n).padStart(12, '0')}`,
    ticket_id: tid(t.n),
    sender_id: customerIds[t.cust],
    sender_type: 'user',
    body: t.msg,
    is_internal_note: false,
    created_at: minsAgo(t.age),
  }])
  const { error: msgErr } = await secondary.from('chat_messages').upsert(messages, { onConflict: 'id' })
  if (msgErr) console.warn(`! chat_messages skipped: ${msgErr.message}`)
  else console.log(`✓ ${messages.length} test chat messages in secondary`)

  console.log('\nDone. Open /admin/active-chats — expect 8 open chats; the RESOLVED/CLOSED ones stay hidden.')
}

async function cleanup() {
  const ids = TICKETS.map(t => tid(t.n))
  await secondary.from('chat_messages').delete().in('ticket_id', ids)
  const { error: tErr } = await secondary.from('support_tickets').delete().in('ticket_id', ids)
  if (tErr) throw new Error(`support_tickets: ${tErr.message}`)
  if (!primary) {
    const { error: uErr } = await secondary.from('users').delete().in('user_id', CUSTOMERS.map(c => c.user_id))
    if (uErr) console.warn(`! customers not removed: ${uErr.message}`)
  } else {
    const { data } = await primary.auth.admin.listUsers({ perPage: 1000 })
    for (const u of data?.users ?? []) {
      if (u.email?.endsWith(`@${TEST_DOMAIN}`)) await primary.auth.admin.deleteUser(u.id) // cascades to admin_users
    }
  }
  console.log('✓ Removed all seeded test data')
}

;(CLEANUP ? cleanup() : seed()).catch(err => {
  console.error('Seed failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
