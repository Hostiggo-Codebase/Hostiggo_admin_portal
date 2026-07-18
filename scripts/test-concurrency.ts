/**
 * M2 concurrency test: 50 concurrent create_ticket calls with 3 agents online.
 * Verifies: zero double-assignment, no agent exceeds 2 active chats.
 *
 * Usage:
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_KEY=<service_key>   \
 *   npx tsx scripts/test-concurrency.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = process.env.SUPABASE_URL!
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY!
const CONCURRENCY      = 50

if (!SUPABASE_URL || !SUPABASE_SERVICE) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

async function setup() {
  // Ensure 3 agent users exist (seeded externally) and set them ONLINE + accepting
  const { data: agents } = await supabase
    .from('admin_users')
    .select('admin_id')
    .eq('role', 'ADMIN')
    .limit(3)

  if (!agents || agents.length < 3) {
    throw new Error('Need at least 3 agent rows in admin_users. Run the seed first.')
  }

  await supabase
    .from('admin_users')
    .update({ agent_status: 'ONLINE', accepting_new_chats: true, active_chat_count: 0 })
    .in('admin_id', agents.map((a) => a.admin_id))

  return agents.map((a) => a.admin_id)
}

async function runTest(categoryId: string) {
  const tasks = Array.from({ length: CONCURRENCY }, (_, i) =>
    supabase.rpc('create_ticket', {
      p_category_id:    categoryId,
      p_subject:        `Concurrency test ticket ${i}`,
      p_description:    `Test ${i}`,
      p_priority_label: 'General',
    })
  )

  const results = await Promise.allSettled(tasks)
  const failed  = results.filter((r) => r.status === 'rejected')
  console.log(`Created: ${CONCURRENCY - failed.length} / ${CONCURRENCY}`)
  if (failed.length) console.log('Failures:', failed)
}

async function verify(agentIds: string[]) {
  const { data: agents } = await supabase
    .from('admin_users')
    .select('admin_id, display_name, active_chat_count')
    .in('admin_id', agentIds)

  let passed = true
  for (const agent of agents ?? []) {
    const ok = agent.active_chat_count <= 2
    console.log(
      `Agent ${agent.display_name}: active_chat_count = ${agent.active_chat_count} ${ok ? '✓' : '✗ EXCEEDED'}`
    )
    if (!ok) passed = false
  }

  // Check for double-assigned tickets
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('ticket_id, assigned_agent_id, status')
    .in('status', ['ASSIGNED', 'ACTIVE'])

  const agentTicketCounts = new Map<string, number>()
  for (const t of tickets ?? []) {
    if (!t.assigned_agent_id) continue
    agentTicketCounts.set(
      t.assigned_agent_id,
      (agentTicketCounts.get(t.assigned_agent_id) ?? 0) + 1
    )
  }

  for (const [agentId, count] of Array.from(agentTicketCounts)) {
    const ok = count <= 2
    console.log(`Agent ${agentId}: assigned tickets = ${count} ${ok ? '✓' : '✗ DOUBLE-ASSIGNED'}`)
    if (!ok) passed = false
  }

  console.log(passed ? '\nAll checks passed ✓' : '\nSome checks FAILED ✗')
  process.exit(passed ? 0 : 1)
}

async function main() {
  const agentIds = await setup()

  // Get any category
  const { data: cats } = await supabase.from('complaint_categories').select('id').limit(1)
  const categoryId = cats?.[0]?.id
  if (!categoryId) throw new Error('No categories found — run seed.sql first')

  await runTest(categoryId)
  await verify(agentIds)
}

main().catch((err) => { console.error(err); process.exit(1) })
