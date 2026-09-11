'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io, Socket } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://hostiggo-admin-portal.onrender.com'


let socketInstance: Socket | null = null

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
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

    // Join ticket chat room on Socket.io server
    socket.emit('join_ticket', { ticket_id: ticketId })

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
      socket.off('new_message', handleNewMessage)
      socket.off('ticket_updated', handleTicketUpdated)
      socket.off('queue_updated', handleTicketUpdated)
      clearInterval(pollInterval)
    }
  }, [ticketId, queryClient])
}

