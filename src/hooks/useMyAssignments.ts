'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useMyAssignments(agentId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!agentId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`agent:${agentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_tickets',
          filter: `assigned_agent_id=eq.${agentId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['my-assigned'] })
          queryClient.invalidateQueries({ queryKey: ['queue'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [agentId, queryClient])
}
