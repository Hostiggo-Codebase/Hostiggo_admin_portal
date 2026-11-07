// Open = any status where the chat is still being worked (same set the queue shows).
export const OPEN_STATUSES = [
  'QUEUED', 'ASSIGNED', 'ACTIVE', 'WAITING_ON_USER', 'ESCALATED', 'REOPENED',
] as const

export type RawTicket = {
  ticket_id?: string | null
  id?: string | null
  ticket_number?: string | null
  subject?: string | null
  status?: string | null
  priority?: number | null
  priority_label?: string | null
  user_id?: string | null
  assigned_agent_id?: string | null
  assigned_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  last_user_activity?: string | null
}

export type PersonInfo = { name: string; email: string | null }

export type ActiveChatRow = {
  ticket_id: string
  ticket_number: string
  subject: string
  status: string
  priority: number
  priority_label: string
  created_at: string
  assigned_at: string | null
  last_activity_at: string
  customer: { id: string | null; name: string; email: string | null }
  // null while the chat is still waiting in the queue for an admin.
  admin: { id: string; name: string } | null
}

const shortId = (id: string) => id.slice(0, 8)

export function isOpenStatus(status: string | null | undefined): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status ?? '')
}

export function buildActiveChats(
  tickets: RawTicket[],
  customers: Map<string, PersonInfo>,
  admins: Map<string, PersonInfo>,
): ActiveChatRow[] {
  const byId = new Map<string, ActiveChatRow>()

  for (const t of tickets) {
    const id = t.ticket_id || t.id
    if (!id || !isOpenStatus(t.status)) continue

    const created = t.created_at || new Date().toISOString()
    const customerId = t.user_id ?? null
    const customer = customerId ? customers.get(customerId) : undefined
    const adminId = t.assigned_agent_id || null
    const admin = adminId ? admins.get(adminId) : undefined

    byId.set(id, {
      ticket_id: id,
      ticket_number: t.ticket_number || `HG-${id.slice(0, 5)}`,
      subject: t.subject || 'Customer support request',
      status: t.status as string,
      priority: t.priority ?? 4,
      priority_label: t.priority_label || 'General',
      created_at: created,
      assigned_at: t.assigned_at ?? null,
      last_activity_at: t.last_user_activity || t.updated_at || created,
      customer: {
        id: customerId,
        name: customer?.name || (customerId ? `Customer ${shortId(customerId)}` : 'Unknown customer'),
        email: customer?.email ?? null,
      },
      admin: adminId ? { id: adminId, name: admin?.name || `Admin ${shortId(adminId)}` } : null,
    })
  }

  return Array.from(byId.values()).sort(
    (a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at),
  )
}
