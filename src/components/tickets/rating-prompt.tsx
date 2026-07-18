'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rateTicket } from '@/lib/services/ticketService'

interface Props {
  ticketId: string
  existingRating: number | null
}

export function RatingPrompt({ ticketId, existingRating }: Props) {
  const [rating, setRating] = useState(existingRating ?? 0)
  const [comment, setComment] = useState('')
  const [done, setDone] = useState(!!existingRating)
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: () => rateTicket(ticketId, rating, comment || undefined),
    onSuccess: () => {
      setDone(true)
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
    },
  })

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
        Thanks for your feedback! You rated this {existingRating ?? rating}/5.
      </div>
    )
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      <p className="text-sm font-medium text-blue-900">How was your support experience?</p>
      <div className="flex gap-2">
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            onClick={() => setRating(n)}
            className={`text-2xl transition-transform hover:scale-110 ${rating >= n ? 'opacity-100' : 'opacity-30'}`}
          >
            ★
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment (optional)"
            rows={2}
            className="w-full border border-blue-300 rounded px-2 py-1 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => mutate()}
            disabled={isPending}
            className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Submitting…' : 'Submit rating'}
          </button>
        </>
      )}
    </div>
  )
}
