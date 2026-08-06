'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { reopenTicket } from '@/lib/services/ticketService'
import { useRouter } from 'next/navigation'

interface Props { ticketId: string; reopenWindowExpiresAt: string }

export function ReopenButton({ ticketId, reopenWindowExpiresAt }: Props) {
  const [reason, setReason] = useState('')
  const [show, setShow] = useState(false)
  const router = useRouter()

  const { mutate, isPending } = useMutation({
    mutationFn: () => reopenTicket(ticketId, reason),
    onSuccess: () => router.refresh(),
  })

  const expiresAt = new Date(reopenWindowExpiresAt)
  const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 3600000))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-yellow-800">
          Not satisfied? You can reopen this ticket ({hoursLeft}h left).
        </p>
        <button onClick={() => setShow(v => !v)} className="text-sm text-yellow-700 underline">
          {show ? 'Cancel' : 'Reopen'}
        </button>
      </div>
      {show && (
        <div className="flex gap-2">
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Why are you reopening this ticket?"
            className="flex-1 border border-yellow-300 rounded px-2 py-1 text-sm focus:outline-none"
          />
          <button
            onClick={() => mutate()}
            disabled={!reason.trim() || isPending}
            className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 disabled:opacity-50"
          >
            {isPending ? '…' : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  )
}
