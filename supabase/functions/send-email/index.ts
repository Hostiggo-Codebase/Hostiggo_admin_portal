import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_ADDRESS = 'support@hostiggo.com'

interface NotificationRecord {
  id: string
  user_id: string
  ticket_id: string | null
  type: string
  payload: Record<string, unknown>
}

interface WebhookPayload {
  type: 'INSERT'
  table: string
  record: NotificationRecord
}

const templates: Record<string, (payload: Record<string, unknown>) => { subject: string; html: string }> = {
  ASSIGNED: (p) => ({
    subject: `[Hostiggo] Your support ticket has been assigned`,
    html: `<p>Your ticket <strong>${p.ticket_number ?? ''}</strong> has been assigned to an agent. You'll hear from us shortly.</p>`,
  }),
  STATUS_CHANGE: (p) => ({
    subject: `[Hostiggo] Ticket status updated: ${p.new_status}`,
    html: `<p>Your ticket status changed to <strong>${p.new_status}</strong>.</p>${p.reason ? `<p>Reason: ${p.reason}</p>` : ''}`,
  }),
  ESCALATED: (p) => ({
    subject: `[Hostiggo] Ticket escalated`,
    html: `<p>Your ticket has been escalated to our senior support team. We'll follow up soon.</p>`,
  }),
  default: () => ({
    subject: `[Hostiggo] Support update`,
    html: `<p>There's an update on your Hostiggo support ticket.</p>`,
  }),
}

async function getUserEmail(userId: string): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
  })
  if (!res.ok) return null
  const { email } = await res.json()
  return email ?? null
}

async function sendEmail(to: string, subject: string, html: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  })
}

serve(async (req) => {
  const body = (await req.json()) as WebhookPayload

  if (body.type !== 'INSERT' || body.table !== 'notifications') {
    return new Response('ignored', { status: 200 })
  }

  const { user_id, type, payload } = body.record
  const email = await getUserEmail(user_id)
  if (!email) return new Response('no email', { status: 200 })

  const builder = templates[type] ?? templates.default
  const { subject, html } = builder(payload)

  await sendEmail(email, subject, html)

  return new Response('ok', { status: 200 })
})
