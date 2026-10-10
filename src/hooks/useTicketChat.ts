'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io, Socket } from 'socket.io-client'

// Hardcoded for dev: always the production socket service, ignoring NEXT_PUBLIC_SOCKET_URL and localhost.
// To use another server (e.g. `npm run socket` on :4000), change this constant.
const SOCKET_URL = 'https://hostiggoadminportal-production.up.railway.app'

function getSocketUrl(): string {
  return SOCKET_URL
}

let socketInstance: Socket | null = null

export function getSocket(): Socket {
  if (!socketInstance) {
    const socketUrl = getSocketUrl()
    console.log('🔌 [Socket.io Admin] Connecting to WebSocket Server:', socketUrl)

    socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    socketInstance.on('connect', () => {
      console.log(
        '🟢 [Socket.io Admin] Connected to Live Socket Server. Messages can arrive via Socket.io now.',
        {
          id: socketInstance?.id,
          transport: socketInstance?.io.engine.transport.name,
        }
      )
    })

    socketInstance.io.engine.on('upgrade', (transport) => {
      console.log('[Socket.io Admin] Transport upgraded:', transport.name)
    })

    socketInstance.on('disconnect', (reason) => {
      console.warn('[Socket.io Admin] Disconnected from Socket.io server:', reason)
    })

    socketInstance.io.on('reconnect', (attempt) => {
      console.log('[Socket.io Admin] Reconnected to Socket.io server after attempt:', attempt)
    })

    socketInstance.on('connect_error', (err) => {
      console.error('🔴 [Socket.io Admin] Connection Error:', err.message)
    })
  }
  return socketInstance
}

// Eagerly connect socket on client load
if (typeof window !== 'undefined') {
  getSocket()
}



export function useTicketChat(ticketId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!ticketId) return

    const socket = getSocket()

    const appendSocketMessage = (message: any) => {
      if (!message || message.ticket_id !== ticketId) return
      queryClient.setQueryData(['messages', ticketId], (old: unknown) => {
        const messages = Array.isArray(old) ? old : []
        if (messages.some((msg: any) => msg.id === message.id)) return messages
        return [...messages, message]
      })
    }

    // Rooms live server-side and are lost on reconnect, so (re)join on every connect.
    const join = () => {
      console.log('[Socket.io Admin] Joining ticket/agents rooms on Socket.io server:', {
        ticketId,
        connected: socket.connected,
        transport: socket.io.engine.transport.name,
      })
      socket.emit('join_ticket', { ticket_id: ticketId })
      socket.emit('join_agents')
    }
    if (socket.connected) join()
    socket.on('connect', join)

    const handleNewMessage = (msg: any) => {
      if (msg?.ticket_id && msg.ticket_id !== ticketId) return
      console.log('[Socket.io Admin] Message received from Socket.io ticket room:', {
        ticketId,
        messageId: msg?.id,
        senderType: msg?.sender_type,
        transport: socket.io.engine.transport.name,
      })
      appendSocketMessage(msg)
    }

    const handleGlobalChatActivity = (event: any) => {
      if (event?.ticket_id !== ticketId) return
      console.log('[Socket.io Admin] Message received from Socket.io global activity:', {
        ticketId,
        messageId: event?.message?.id,
        senderType: event?.message?.sender_type,
        transport: socket.io.engine.transport.name,
      })
      appendSocketMessage(event?.message)
    }

    const handleTicketUpdated = (data: any) => {
      console.log('[Socket.io Admin] Ticket updated:', data)
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['queue'] })
    }

    socket.on('new_message', handleNewMessage)
    socket.on('global_chat_activity', handleGlobalChatActivity)
    socket.on('ticket_updated', handleTicketUpdated)
    socket.on('queue_updated', handleTicketUpdated)
    if (!socket.connected) {
      socket.connect()
    }

    return () => {
      console.log('[Socket.io Admin] Leaving ticket room on Socket.io server:', ticketId)
      socket.emit('leave_ticket', { ticket_id: ticketId })
      socket.off('connect', join)
      socket.off('new_message', handleNewMessage)
      socket.off('global_chat_activity', handleGlobalChatActivity)
      socket.off('ticket_updated', handleTicketUpdated)
      socket.off('queue_updated', handleTicketUpdated)
    }
  }, [ticketId, queryClient])
}
