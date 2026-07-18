'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMessages, sendMessage, setDisconnectGrace } from '@/lib/services/ticketService'
import { useTicketChat } from '@/hooks/useTicketChat'
import { useTypingIndicator } from '@/hooks/useTypingIndicator'
import { MessageBubble } from './message-bubble'
import type { TicketStatus } from '@/types/app'

interface Props {
  ticketId: string
  currentUserId: string
  status: TicketStatus
  isAgent?: boolean
  showInternalNoteToggle?: boolean
}

export function ChatPane({ ticketId, currentUserId, status, isAgent, showInternalNoteToggle }: Props) {
  const [body, setBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  useTicketChat(ticketId)
  const { typingUsers, sendTyping } = useTypingIndicator(ticketId, currentUserId)

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', ticketId],
    queryFn: () => getMessages(ticketId),
  })

  const { mutate: send, isPending } = useMutation({
    mutationFn: () => sendMessage({ ticketId, body: body.trim(), isInternalNote: isInternal }),
    onSuccess: () => {
      setBody('')
      queryClient.invalidateQueries({ queryKey: ['messages', ticketId] })
    },
    onError: (err: Error) => {
      if (err.message.includes('RATE_LIMITED')) {
        setRateLimited(true)
        setTimeout(() => setRateLimited(false), 10_000)
      }
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      if (status === 'ACTIVE' || status === 'WAITING_ON_USER') {
        setDisconnectGrace(ticketId).catch(() => {})
      }
    }
  }, [ticketId, status])

  const isClosed = status === 'CLOSED'
  const canSend = !isClosed && body.trim().length > 0 && !isPending && !rateLimited

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.sender_id === currentUserId}
          />
        ))}
        {typingUsers.length > 0 && (
          <div className="self-start text-xs text-gray-500 italic">
            {typingUsers.map(u => u.displayName).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!isClosed && (
        <div className="border-t bg-white p-3 flex flex-col gap-2">
          {showInternalNoteToggle && isAgent && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={e => setIsInternal(e.target.checked)}
                className="rounded"
              />
              Internal note (hidden from user)
            </label>
          )}
          <div className="flex gap-2">
            <textarea
              value={body}
              onChange={e => {
                setBody(e.target.value)
                sendTyping('Me')
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canSend) send() }
              }}
              placeholder={isClosed ? 'This ticket is closed' : 'Type a message… (Enter to send)'}
              rows={2}
              className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <button
              onClick={() => send()}
              disabled={!canSend}
              className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 self-end"
            >
              Send
            </button>
          </div>
          {rateLimited && (
            <p className="text-xs text-red-500">Sending too fast — wait a moment.</p>
          )}
        </div>
      )}
    </div>
  )
}
