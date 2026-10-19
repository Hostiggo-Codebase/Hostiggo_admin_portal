import { beforeEach, expect, it, vi } from 'vitest'

const { primaryFrom, secondaryFrom } = vi.hoisted(() => ({
  primaryFrom: vi.fn(), secondaryFrom: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: primaryFrom }) }))
vi.mock('@/lib/supabase/secondary', () => ({ secondaryClient: { from: secondaryFrom } }))

import { GET as getMessages } from './route'
import { GET as getQueue } from '../queue/route'

function query(data: unknown[], error: unknown = null) {
  const result = { data, error }
  const chain: Record<string, unknown> = {
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
  }
  for (const method of ['select', 'eq', 'order', 'abortSignal']) chain[method] = () => chain
  return chain
}

beforeEach(() => vi.resetAllMocks())

it('loads chat directly without waiting on the broken bridge', async () => {
  const message = { id: 'message', ticket_id: 'ticket', body: 'Help', created_at: '2026-10-16T00:00:00Z' }
  secondaryFrom.mockReturnValue(query([message]))
  primaryFrom.mockImplementation((table) => {
    if (table !== 'chat_messages') throw new Error('Bridge must not be queried')
    return query([])
  })
  const response = await getMessages(new Request('http://localhost/api/messages?ticketId=ticket'))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual([message])
  expect(primaryFrom).toHaveBeenCalledTimes(1)
})

it('loads the live queue without waiting on the broken bridge', async () => {
  secondaryFrom.mockReturnValue(query([{ ticket_id: 'ticket', status: 'QUEUED' }]))
  primaryFrom.mockImplementation((table) => {
    if (table !== 'support_tickets') throw new Error('Bridge must not be queried')
    return query([])
  })
  const response = await getQueue()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual([expect.objectContaining({ ticket_id: 'ticket' })])
  expect(primaryFrom).toHaveBeenCalledTimes(1)
})

it('falls back to bridge messages when the direct app read fails', async () => {
  const message = { id: 'bridge-message', created_at: '2026-10-16T00:00:00Z' }
  secondaryFrom.mockReturnValue(query([], { message: 'offline' }))
  primaryFrom.mockImplementation((table) => query(table === 'fdw_chat_messages' ? [message] : []))
  const response = await getMessages(new Request('http://localhost/api/messages?ticketId=ticket'))
  expect(await response.json()).toEqual([message])
  expect(primaryFrom).toHaveBeenCalledWith('fdw_chat_messages')
})
