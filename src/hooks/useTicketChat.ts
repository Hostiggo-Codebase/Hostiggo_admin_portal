'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io, Socket } from 'socket.io-client'

function getSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:4000'
  }
  return 'https://hostiggoadminportal-production.up.railway.app'
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
      console.log('🟢 [Socket.io Admin] Connected to Live Socket Server! ID:', socketInstance?.id)
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

    // Rooms live server-side and are lost on reconnect, so (re)join on every connect.
    const join = () => {
      socket.emit('join_ticket', { ticket_id: ticketId })
      socket.emit('join_agents')
    }
    if (socket.connected) join()
    socket.on('connect', join)

    const handleNewMessage = (msg: any) => {
      console.log('[Socket.io Admin] New message received:', msg)
      queryClient.invalidateQueries({ queryKey: ['messages', ticketId] })
    }

    const handleTicketUpdated = (data: any) => {
      console.log('[Socket.io Admin] Ticket updated:', data)
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['queue'] })
    }

    socket.on('new_message', handleNewMessage)
    socket.on('ticket_updated', handleTicketUpdated)
    socket.on('queue_updated', handleTicketUpdated)

    // Fallback Poll every 1.5 seconds while chat view is active
    const pollInterval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['messages', ticketId] })
    }, 1500)

    return () => {
      socket.emit('leave_ticket', { ticket_id: ticketId })
      socket.off('connect', join)
      socket.off('new_message', handleNewMessage)
      socket.off('ticket_updated', handleTicketUpdated)
      socket.off('queue_updated', handleTicketUpdated)
      clearInterval(pollInterval)
    }
  }, [ticketId, queryClient])
}

