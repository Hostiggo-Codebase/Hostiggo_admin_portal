'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

export default function TicketError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 bg-white p-6">
      <p className="text-sm text-gray-700">Unable to load this ticket. Please try again.</p>
      <button
        disabled={pending}
        onClick={() => startTransition(() => { router.refresh(); reset() })}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? 'Opening…' : 'Try again'}
      </button>
      <Link href="/admin/queue" className="text-sm text-indigo-600">Back to queue</Link>
    </div>
  )
}
