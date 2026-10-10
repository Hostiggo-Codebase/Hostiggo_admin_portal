import http from 'http'
import express from 'express'
import { Server } from 'socket.io'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// Main Supabase Database Credentials
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jhihqmkqvbwfniwculhk.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoaWhxbWtxdmJ3Zm5pd2N1bGhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTM1NzgsImV4cCI6MjA3OTI4OTU3OH0.b7AUBFdFMK0XJo8Q3xMzruma60vyj-4CgMrKFPgMenk'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  global: { WebSocket: ws },
})

const DEFAULT_CATEGORY_ID = 'ca222222-2222-2222-2222-222222222222'
const ACTIVE_STATUSES = ['QUEUED', 'ASSIGNED', 'ACTIVE', 'WAITING_ON_USER', 'REOPENED']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeUserPayload(data = {}) {
  const email = String(data.email || data.user_email || '').trim().toLowerCase()
  const name = String(data.name || data.display_name || data.user_name || 'Hostiggo User').trim()
  const phone = data.phone ? String(data.phone).trim() : null
  const requestedUserId =
    typeof data.user_id === 'string' && UUID_RE.test(data.user_id)
      ? data.user_id
      : typeof data.sender_id === 'string' && UUID_RE.test(data.sender_id)
        ? data.sender_id
        : null

  return { email, name, phone, requestedUserId }
}

async function findOrCreateMobileUser(data = {}) {
  const { email, name, phone, requestedUserId } = normalizeUserPayload(data)

  if (!email && !requestedUserId) {
    throw new Error('email or user_id is required when ticket_id is missing')
  }

  const usersTable = supabase.schema('hostiggo_testing_schema').from('users')

  let user = null
  if (requestedUserId) {
    const { data: userById, error } = await usersTable
      .select('*')
      .eq('user_id', requestedUserId)
      .maybeSingle()
    if (error) throw error
    user = userById
  }

  if (!user && email) {
    const { data: userByEmail, error } = await usersTable
      .select('*')
      .eq('email', email)
      .maybeSingle()
    if (error) throw error
    user = userByEmail
  }

  if (!user) {
    const insertPayload = {
      name,
      email: email || `${requestedUserId}@hostiggo.local`,
      phone,
    }
    if (requestedUserId) insertPayload.user_id = requestedUserId

    const { data: insertedUser, error } = await usersTable
      .insert(insertPayload)
      .select()
      .single()

    if (error) throw error
    user = insertedUser
  } else {
    const updatePayload = { name, phone }
    if (email) updatePayload.email = email

    const { data: updatedUser } = await usersTable
      .update(updatePayload)
      .eq('user_id', user.user_id)
      .select()
      .maybeSingle()
    if (updatedUser) user = updatedUser
  }

  return user
}

async function findOrCreateMobileTicket(data = {}) {
  const suppliedTicketId = data.ticket_id
  const placeholderTicketId =
    suppliedTicketId === 'support' ||
    suppliedTicketId === 'x' ||
    suppliedTicketId === '00000000-0000-0000-0000-000000000000' ||
    suppliedTicketId === data.sender_id ||
    suppliedTicketId === data.user_id

  if (suppliedTicketId && !placeholderTicketId) {
    const { data: existingTicket, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('ticket_id', suppliedTicketId)
      .maybeSingle()

    if (error) throw error
    if (existingTicket) return { ...existingTicket, created: false }
  }

  const user = await findOrCreateMobileUser(data)

  const { data: activeTicket, error: fetchError } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', user.user_id)
    .in('status', ACTIVE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (activeTicket) {
    return { ...activeTicket, created: false }
  }

  const { data: newTicket, error: createError } = await supabase
    .from('support_tickets')
    .insert({
      user_id: user.user_id,
      category_id: data.category_id || DEFAULT_CATEGORY_ID,
      subject: data.subject || 'App Support Chat',
      description: data.description || data.body || 'Support chat started from the mobile app.',
      priority_label: data.priority_label || 'General',
      priority: data.priority || 3,
      status: 'QUEUED',
    })
    .select()
    .single()

  if (createError) throw createError
  return { ...newTicket, created: true }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// The mobile app labels guests/hosts 'student'; the chat_messages CHECK
// constraint only allows user | agent | system.
const normalizeSenderType = (t) => (t === 'agent' || t === 'system' ? t : 'user')

// Internal notes are agent-only: never fan them out to a ticket room, which
// the guest/host app is also in. Admin UIs pick them up via /api/messages.
const emitMessage = (ticket_id, message) => {
  if (!message.is_internal_note) io.to(`ticket:${ticket_id}`).emit('new_message', message)
  io.to('agents').emit('global_chat_activity', { ticket_id, message })
  // A customer message can be a brand-new ticket: make every open admin queue refresh right away.
  if (message.sender_type === 'user') io.to('agents').emit('queue_updated', { ticket_id })
}

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`)

  // Join a ticket chat room
  socket.on('join_ticket', ({ ticket_id }) => {
    if (!ticket_id) return
    const roomName = `ticket:${ticket_id}`
    socket.join(roomName)
    console.log(`[Socket.io] Socket ${socket.id} joined room ${roomName}`)
  })

  // Agent dashboards subscribe to cross-ticket activity here.
  socket.on('join_agents', () => socket.join('agents'))

  // Leave a ticket chat room
  socket.on('leave_ticket', ({ ticket_id }) => {
    if (!ticket_id) return
    const roomName = `ticket:${ticket_id}`
    socket.leave(roomName)
    console.log(`[Socket.io] Socket ${socket.id} left room ${roomName}`)
  })

  // Used by clients that have already persisted their own message directly to
  // Supabase. Broadcasting separately avoids a second database insert.
  socket.on('broadcast_message', ({ ticket_id, message }) => {
    if (!ticket_id || !message) return
    emitMessage(ticket_id, message)
  })

  // Send & broadcast real-time chat message
  socket.on('send_message', async (data) => {
    const { body } = data
    if (!body) return

    console.log(`[Socket.io] Incoming message from ${data.sender_type || 'user'}: ${body}`)

    try {
      const ticket = await findOrCreateMobileTicket(data)
      const ticket_id = ticket.ticket_id
      const sender_id = data.sender_id || data.user_id || ticket.user_id
      const sender_type = normalizeSenderType(data.sender_type)
      const is_internal_note = sender_type === 'agent' && data.is_internal_note === true

      if (!ticket_id || !sender_id) {
        throw new Error('Could not resolve ticket_id or sender_id for message')
      }

      socket.join(`ticket:${ticket_id}`)

      // 1. Insert message into Supabase DB chat_messages table
      const { data: insertedMsg, error } = await supabase
        .from('chat_messages')
        .insert({
          ticket_id,
          sender_id,
          sender_type,
          body,
          is_internal_note,
        })
        .select()
        .single()

      if (error) {
        // Do not broadcast an unpersisted message: it would vanish on the
        // next fetch. Tell the sender instead.
        console.error('[Socket.io] Error inserting message into DB:', error.message)
        socket.emit('message_error', { ticket_id, error: error.message })
        return
      }

      socket.emit('support_chat_ready', { ticket_id, ticket, message: insertedMsg })
      emitMessage(ticket_id, insertedMsg)
      io.emit('queue_updated', { ticket_id, status: ticket.status || 'QUEUED' })
    } catch (err) {
      console.error('[Socket.io] Send message exception:', err)
      socket.emit('send_message_error', { error: err.message || 'Message send failed' })
    }
  })

  // Broadcast ticket status changes (Take, Hold, Complete)
  socket.on('ticket_status_change', async ({ ticket_id, status, agent_id }) => {
    if (!ticket_id || !status) return

    console.log(`[Socket.io] Ticket ${ticket_id} status changed to ${status}`)

    try {
      await supabase
        .from('support_tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('ticket_id', ticket_id)

      io.to(`ticket:${ticket_id}`).emit('ticket_updated', { ticket_id, status })
      io.emit('queue_updated', { ticket_id, status })
    } catch (err) {
      console.error('[Socket.io] Ticket status change exception:', err)
    }
  })

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`)
  })
})

const PORT = process.env.PORT || 4000
server.listen(PORT, () => {
  console.log(`🚀 Socket.io WebSocket Server running on http://localhost:${PORT}`)
})
