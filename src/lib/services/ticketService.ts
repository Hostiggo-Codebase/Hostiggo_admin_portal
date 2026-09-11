import { createClient } from '@/lib/supabase/client'
import type {
  TicketStatus,
  PriorityLabel,
  CreateTicketParams,
  SendMessageParams,
  TicketWithDetails,
  ChatMessage,
  AgentPresenceStatus,
  VideoSubmission,
  KYCSubmission,
  UserKYCStatus,
  SubmitKYCParams,
} from '@/types/app'

// Typed wrappers around Supabase RPC calls.
// The `as any` cast is intentional: the generated DB types and postgrest-js
// generic resolution disagree on how security-definer plpgsql function args
// are typed. The SQL interface is correct; this is a type-level workaround.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) =>
  (createClient() as any).rpc(fn, args)

// ---------------------------------------------------------------------------
// Shared row types (mirrors DB schema, used as explicit return annotations)
// ---------------------------------------------------------------------------

export type TicketListRow = {
  ticket_id: string
  ticket_number: string | null
  subject: string
  status: string
  priority: number
  priority_label: string
  created_at: string
  updated_at: string | null
  queued_at: string
  assigned_at: string | null
  first_response_at: string | null
  assigned_agent_id: string | null
  complaint_categories: { name: string } | null
  rating?: number | null
}

export type AgentRow = {
  admin_id: string
  display_name: string
  active_chat_count: number
  agent_status: string
}

// ---------------------------------------------------------------------------
// Ticket operations
// ---------------------------------------------------------------------------

export async function createTicket(params: CreateTicketParams) {
  const { data, error } = await rpc('create_ticket', {
    p_category_id:    params.categoryId,
    p_subject:        params.subject,
    p_description:    params.description,
    p_priority_label: params.priorityLabel,
    p_booking_id:     params.bookingId,
    p_property_id:    params.propertyId,
    p_deferred_type:  params.deferredType,
    p_callback_phone: params.callbackPhone,
    p_callback_slot:  params.callbackSlot,
  })
  if (error) throw error
  return data as { ticket_id: string; status: TicketStatus; duplicate: boolean; existing_ticket_id?: string }
}

export async function reopenTicket(ticketId: string, reason: string): Promise<void> {
  const { error } = await rpc('reopen_ticket', { p_ticket_id: ticketId, p_reason: reason })
  if (error) throw error
}

export async function rateTicket(ticketId: string, rating: number, comment?: string): Promise<void> {
  const { error } = await rpc('rate_ticket', { p_ticket_id: ticketId, p_rating: rating, p_comment: comment })
  if (error) throw error
}

export async function setDisconnectGrace(ticketId: string): Promise<void> {
  const { error } = await rpc('set_disconnect_grace', { p_ticket_id: ticketId })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export async function getMessages(ticketId: string): Promise<ChatMessage[]> {
  try {
    const res = await fetch(`/api/messages?ticketId=${ticketId}`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        return data as ChatMessage[]
      }
    }
  } catch (e) {
    console.log('Error fetching /api/messages:', e)
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*, message_attachments (*)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as ChatMessage[]
}

export async function sendMessage(params: SendMessageParams): Promise<string> {
  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId: params.ticketId,
        body: params.body,
        isInternalNote: params.isInternalNote ?? false,
      }),
    })
    if (res.ok) {
      const { messageId } = await res.json()
      if (messageId) return messageId
    }
  } catch (e) {
    console.log('Error sending /api/messages:', e)
  }

  const { data, error } = await rpc('send_message', {
    p_ticket_id:        params.ticketId,
    p_body:             params.body,
    p_is_internal_note: params.isInternalNote ?? false,
  })
  if (error) throw error
  return data as string
}

// ---------------------------------------------------------------------------
// Agent operations
// ---------------------------------------------------------------------------

export async function getQueueTickets(): Promise<TicketListRow[]> {
  try {
    const res = await fetch('/api/queue')
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        return data as TicketListRow[]
      }
    }
  } catch (e) {
    console.log('Error fetching /api/queue:', e)
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('support_tickets')
    .select('ticket_id, ticket_number, subject, status, priority, priority_label, queued_at, assigned_at, first_response_at, created_at, assigned_agent_id, complaint_categories(name)')
    .in('status', ['QUEUED','ASSIGNED','ACTIVE','WAITING_ON_USER','ESCALATED','REOPENED'])
    .order('priority', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as TicketListRow[]
}

export async function getMyAssignedTickets(): Promise<TicketListRow[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthenticated')

  let fdwTickets: any[] = []
  let localTickets: any[] = []

  try {
    const { data: prodData, error: prodErr } = await supabase
      .from('fdw_support_tickets' as any)
      .select('*')
      .eq('assigned_agent_id', user.id)
      .in('status', ['ASSIGNED', 'ACTIVE', 'WAITING_ON_USER'])

    if (!prodErr && prodData) {
      fdwTickets = prodData
    }
  } catch (e) {
    console.log('FDW assigned error:', e)
  }

  try {
    const { data: localData, error: localErr } = await supabase
      .from('support_tickets')
      .select('ticket_id, ticket_number, subject, status, priority, priority_label, queued_at, assigned_at, first_response_at, created_at, assigned_agent_id, complaint_categories(name)')
      .eq('assigned_agent_id', user.id)
      .in('status', ['ASSIGNED', 'ACTIVE', 'WAITING_ON_USER'])

    if (!localErr && localData) {
      localTickets = localData
    }
  } catch (e) {
    console.log('Local assigned error:', e)
  }

  const combinedMap = new Map<string, any>()
  for (const t of [...fdwTickets, ...localTickets]) {
    if (t && t.ticket_id) {
      combinedMap.set(t.ticket_id, t)
    }
  }

  return Array.from(combinedMap.values()) as unknown as TicketListRow[]
}

export async function changeStatus(ticketId: string, newStatus: TicketStatus, note?: string): Promise<void> {
  try {
    const res = await fetch('/api/tickets/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change_status', ticketId, newStatus, note }),
    })
    if (res.ok) return
  } catch (e) {
    console.log('Error in API ticket action changeStatus:', e)
  }

  const { error } = await rpc('change_status', {
    p_ticket_id:  ticketId,
    p_new_status: newStatus,
    p_note:       note,
  })
  if (error) throw error
}

export async function escalateTicket(ticketId: string, reason: string): Promise<void> {
  try {
    const res = await fetch('/api/tickets/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'escalate_ticket', ticketId, reason }),
    })
    if (res.ok) return
  } catch (e) {
    console.log('Error in API ticket action escalateTicket:', e)
  }

  const { error } = await rpc('escalate_ticket', { p_ticket_id: ticketId, p_reason: reason })
  if (error) throw error
}

export async function transferTicket(ticketId: string, toAgent: string): Promise<void> {
  try {
    const res = await fetch('/api/tickets/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'transfer_ticket', ticketId, toAgent }),
    })
    if (res.ok) return
  } catch (e) {
    console.log('Error in API ticket action transferTicket:', e)
  }

  const { error } = await rpc('transfer_ticket', { p_ticket_id: ticketId, p_to_agent: toAgent })
  if (error) throw error
}

// Claim one specific QUEUED ticket for the calling agent → sets to ACTIVE
export async function takeTicket(ticketId: string): Promise<void> {
  try {
    const res = await fetch('/api/tickets/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'take_ticket', ticketId }),
    })
    if (res.ok) return
  } catch (e) {
    console.log('Error in API ticket action takeTicket:', e)
  }

  const { error } = await rpc('take_ticket', { p_ticket_id: ticketId })
  if (error) throw error
}

// Claim up to `limit` QUEUED tickets in priority order (batch review workflow)
export async function fetchReviewBatch(limit = 10): Promise<string[]> {
  const { data, error } = await rpc('fetch_review_batch', { p_limit: limit })
  if (error) throw error
  return (data ?? []) as string[]
}


export async function setAgentPresence(status: AgentPresenceStatus, accepting: boolean): Promise<void> {
  const { error } = await rpc('set_agent_presence', { p_status: status, p_accepting: accepting })
  if (error) throw error
}

export async function heartbeat(): Promise<void> {
  const { error } = await rpc('heartbeat')
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Super Admin
// ---------------------------------------------------------------------------

export async function resolveEscalation(
  ticketId: string,
  decision: 'REFUND_APPROVED' | 'REFUND_REJECTED' | 'SEND_BACK',
  note?: string
): Promise<void> {
  const { error } = await rpc('resolve_escalation', {
    p_ticket_id: ticketId,
    p_decision:  decision,
    p_note:      note,
  })
  if (error) throw error
}

export type EscalatedTicketRow = {
  ticket_id: string
  ticket_number: string | null
  subject: string
  priority_label: string
  escalated_at: string | null
  complaint_categories: { name: string } | null
  assigned_agent_id: string | null
}

export async function getEscalatedTickets(): Promise<EscalatedTicketRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('support_tickets')
    .select('ticket_id, ticket_number, subject, priority_label, escalated_at, assigned_agent_id, complaint_categories(name)')
    .eq('status', 'ESCALATED')
    .order('escalated_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as EscalatedTicketRow[]
}

export type AuditLogRow = {
  id: string
  admin_id: string | null
  ticket_id: string | null
  action: string
  previous_value: unknown
  new_value: unknown
  created_at: string
}

export async function getAuditLogs(ticketId?: string): Promise<AuditLogRow[]> {
  const supabase = createClient()
  const query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  const { data, error } = await (ticketId ? query.eq('ticket_id', ticketId) : query)
  if (error) throw error
  return (data ?? []) as AuditLogRow[]
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function getNotifications() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Video Submissions
// ---------------------------------------------------------------------------

export async function uploadTicketVideo(
  ticketId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<VideoSubmission> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'mp4'
  const path = `${ticketId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('ticket-videos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
  if (uploadError) throw uploadError
  onProgress?.(80)

  const { data, error } = await rpc('add_video_submission', {
    p_ticket_id:    ticketId,
    p_storage_path: path,
    p_file_name:    file.name,
    p_file_size:    file.size,
    p_mime_type:    file.type,
  })
  if (error) throw error
  onProgress?.(100)

  return { id: data as string, ticket_id: ticketId, user_id: '', storage_path: path,
    file_name: file.name, file_size: file.size, mime_type: file.type,
    status: 'pending', reviewed_by: null, reviewed_at: null,
    created_at: new Date().toISOString() }
}

export async function getTicketVideos(ticketId: string): Promise<VideoSubmission[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('video_submissions')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as VideoSubmission[]
}

export async function getVideoSignedUrl(storagePath: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from('ticket-videos')
    .createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}

// ---------------------------------------------------------------------------
// KYC
// ---------------------------------------------------------------------------

export async function uploadKYCFile(
  userId: string,
  role: 'front' | 'back' | 'selfie',
  file: File,
): Promise<string> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/${role}-${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from('kyc-documents')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  return path
}

export async function submitKYC(params: SubmitKYCParams): Promise<string> {
  const { data, error } = await rpc('submit_kyc', {
    p_document_type:        params.documentType,
    p_document_front_path:  params.documentFrontPath,
    p_document_back_path:   params.documentBackPath ?? null,
    p_selfie_path:          params.selfiePath ?? null,
  })
  if (error) throw error
  return data as string
}

export async function getMyKYCStatus(): Promise<UserKYCStatus | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_kyc_status')
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data as UserKYCStatus | null
}

export async function getMyLatestKYCSubmission(): Promise<KYCSubmission | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as KYCSubmission | null
}

export type KYCQueueRow = KYCSubmission & { signed_front?: string }

export async function getAllPendingKYC(): Promise<KYCSubmission[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as KYCSubmission[]
}

export async function reviewKYC(
  submissionId: string,
  status: 'approved' | 'rejected' | 'resubmit_required',
  rejectionReason?: string,
): Promise<void> {
  const { error } = await rpc('review_kyc', {
    p_submission_id:    submissionId,
    p_status:           status,
    p_rejection_reason: rejectionReason ?? null,
  })
  if (error) throw error
}

export async function getKYCDocumentSignedUrl(storagePath: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from('kyc-documents')
    .createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategoryRow = { id: string; name: string; description: string | null }

export async function getCategories(): Promise<CategoryRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('complaint_categories')
    .select('id, name, description')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as CategoryRow[]
}

// ---------------------------------------------------------------------------
// Available agents (for transfer dialog)
// ---------------------------------------------------------------------------

export async function getAvailableAgents(): Promise<AgentRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('admin_users')
    .select('admin_id, display_name, active_chat_count, agent_status')
    .eq('agent_status', 'ONLINE')
    .order('active_chat_count', { ascending: true })
  if (error) throw error
  return (data ?? []) as AgentRow[]
}
