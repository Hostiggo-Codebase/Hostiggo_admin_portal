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
    const { ticket_id, sender_id, body } = data
    const sender_type = normalizeSenderType(data.sender_type)
    const is_internal_note = sender_type === 'agent' && data.is_internal_note === true
    if (!ticket_id || !sender_id || !body) return

    console.log(`[Socket.io] New message for ticket ${ticket_id} from ${sender_type}: ${body}`)

    try {
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

      emitMessage(ticket_id, insertedMsg)
    } catch (err) {
      console.error('[Socket.io] Send message exception:', err)
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
