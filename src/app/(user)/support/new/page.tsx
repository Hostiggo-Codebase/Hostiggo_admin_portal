'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getCategories, createTicket } from '@/lib/services/ticketService'
import { z } from 'zod'
import type { PriorityLabel } from '@/types/app'

const schema = z.object({
  categoryId:    z.string().uuid('Select a category'),
  subject:       z.string().min(5, 'Subject must be at least 5 characters'),
  description:   z.string().min(20, 'Please describe the issue in at least 20 characters'),
  priorityLabel: z.enum(['Urgent','Payment-Refund','Booking Help','General']),
})

const FALLBACK_CATEGORIES = [
  { id: '7072a038-fd0d-4388-808b-295ac2622b58', name: 'Payment' },
  { id: '586cee2c-7581-40a1-af69-d58112ba9654', name: 'Booking' },
  { id: 'e3417448-abaa-4dff-8f48-2537dbcd393a', name: 'Property' },
  { id: '81db0c34-7adb-4662-bef3-3b343f1f79af', name: 'Refund' },
  { id: '9a262873-de11-44c4-a443-de53aa84e977', name: 'Other' }
]

export default function NewTicketPage() {
  const router = useRouter()
  const [form, setForm] = useState({ categoryId: '', subject: '', description: '', priorityLabel: 'General' as PriorityLabel })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicate, setDuplicate] = useState<string | null>(null)

  const { data: categoriesData = [], error: catError } = useQuery({ queryKey: ['categories'], queryFn: getCategories })
  const categories = categoriesData.length > 0 ? categoriesData : FALLBACK_CATEGORIES


  const { mutate, isPending, error } = useMutation({
    mutationFn: () => createTicket({
      categoryId:    form.categoryId,
      subject:       form.subject,
      description:   form.description,
      priorityLabel: form.priorityLabel,
    }),
    onSuccess: (data) => {
      if (data.duplicate) {
        alert('Duplicate complaint detected: You already have an open ticket for this category.')
        setDuplicate(data.existing_ticket_id!)
      } else {
        alert('Complaint submitted successfully!')
        router.push(`/support/tickets/${data.ticket_id}`)
      }
    },
    onError: (err: any) => {
      alert('Error submitting complaint: ' + err.message)
    }
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = schema.safeParse(form)
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.errors.forEach(e => { errs[e.path[0] as string] = e.message })
      setErrors(errs)
      alert('Validation Error:\n' + Object.values(errs).join('\n'))
      return
    }
    setErrors({})
    mutate()
  }

  const field = (label: string, name: keyof typeof form, el: React.ReactNode) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {el}
      {errors[name] && <p className="text-xs text-red-600 mt-1">{errors[name]}</p>}
    </div>
  )

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Raise a Complaint</h1>

      {catError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          Category load error: {(catError as Error).message}
        </div>
      )}

      {duplicate && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg text-sm">
          <p className="font-medium text-yellow-800">You already have an open ticket for this.</p>
          <button onClick={() => router.push(`/support/tickets/${duplicate}`)}
            className="mt-2 text-yellow-700 underline">
            View existing ticket →
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {field('Category', 'categoryId',
          <select
            value={form.categoryId}
            onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="">Select a category…</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        {field('Priority', 'priorityLabel',
          <select
            value={form.priorityLabel}
            onChange={e => setForm(f => ({ ...f, priorityLabel: e.target.value as PriorityLabel }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option>Urgent</option>
            <option>Payment-Refund</option>
            <option>Booking Help</option>
            <option>General</option>
          </select>
        )}

        {field('Subject', 'subject',
          <input
            type="text"
            value={form.subject}
            onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
            placeholder="Brief summary of your issue"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        )}

        {field('Description', 'description',
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Describe your issue in detail…"
            rows={5}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
          />
        )}

        {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-black text-white py-2.5 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending ? 'Submitting…' : 'Submit Complaint'}
        </button>
      </form>
    </div>
  )
}
