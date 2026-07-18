'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TypingPayload {
  userId: string
  displayName: string
}

export function useTypingIndicator(ticketId: string, myUserId: string) {
  const [typingUsers, setTypingUsers] = useState<TypingPayload[]>([])
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    if (!ticketId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`ticket:${ticketId}:typing`)
      .on('broadcast', { event: 'typing' }, ({ payload }: { payload: TypingPayload }) => {
        if (payload.userId === myUserId) return
        setTypingUsers((prev) => {
          if (prev.find((u) => u.userId === payload.userId)) return prev
          return [...prev, payload]
        })
        // Clear after 3 s of no updates
        const existing = timeoutsRef.current.get(payload.userId)
        if (existing) clearTimeout(existing)
        const t = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId))
        }, 3000)
        timeoutsRef.current.set(payload.userId, t)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      timeoutsRef.current.forEach(clearTimeout)
    }
  }, [ticketId, myUserId])

  const sendTyping = useCallback(
    (displayName: string) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: myUserId, displayName },
      })
    },
    [myUserId]
  )

  return { typingUsers, sendTyping }
}
