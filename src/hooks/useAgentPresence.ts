'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setAgentPresence } from '@/lib/services/ticketService'

export function useAgentPresence(agentId: string | null) {
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  useEffect(() => {
    if (!agentId) return
    const supabase = createClient()

    const channel = supabase
      .channel('agents:presence')
      .on('presence', { event: 'join' }, () => {
        setAgentPresence('ONLINE', true).catch(console.error)
      })
      .on('presence', { event: 'leave' }, () => {
        setAgentPresence('OFFLINE', false).catch(console.error)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ agent_id: agentId, online_at: new Date().toISOString() })
          await setAgentPresence('ONLINE', true)
        }
      })

    channelRef.current = channel

    return () => {
      setAgentPresence('OFFLINE', false).catch(console.error)
      supabase.removeChannel(channel)
    }
  }, [agentId])
}
