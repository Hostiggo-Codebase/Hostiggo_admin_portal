import { afterEach, expect, it, vi } from 'vitest'
import { loadTicket } from './load-ticket'

afterEach(() => vi.useRealTimers())

it('opens a mobile ticket without waiting for a slow local database or bridge', async () => {
  const fallback = vi.fn()
  const ticket = { ticket_id: 'mobile-ticket' }
  const result = await loadTicket([
    () => new Promise<typeof ticket | null>(() => {}),
    async () => ticket,
  ], fallback)
  expect(result).toBe(ticket)
  expect(fallback).not.toHaveBeenCalled()
})

it('opens a local ticket without waiting for a slow secondary database', async () => {
  const ticket = { ticket_id: 'local-ticket', ticket_status_history: [{ id: 'history' }] }
  const fallback = vi.fn()
  expect(await loadTicket([
    async () => ticket,
    () => new Promise<typeof ticket | null>(() => {}),
  ], fallback)).toBe(ticket)
  expect(fallback).not.toHaveBeenCalled()
})

it('does not let an empty response or database failure beat a valid ticket', async () => {
  const ticket = { ticket_id: 'ticket' }
  const fallback = vi.fn()
  expect(await loadTicket([
    async () => null,
    async () => { throw new Error('database unavailable') },
    async () => ticket,
  ], fallback)).toBe(ticket)
  expect(fallback).not.toHaveBeenCalled()
})

it('uses the bridge when both direct sources are missing or unavailable', async () => {
  const ticket = { ticket_id: 'bridge-ticket' }
  const fallback = vi.fn(async () => ticket)
  expect(await loadTicket([
    async () => null,
    async () => { throw new Error('offline') },
  ], fallback)).toBe(ticket)
  expect(fallback).toHaveBeenCalledTimes(1)
})

it('returns null when no source has the ticket', async () => {
  expect(await loadTicket([async () => null, async () => null], async () => null)).toBeNull()
})

it('falls back even when both direct databases never respond', async () => {
  vi.useFakeTimers()
  const ticket = { ticket_id: 'bridge-ticket' }
  const result = loadTicket([
    () => new Promise<typeof ticket | null>(() => {}),
    () => new Promise<typeof ticket | null>(() => {}),
  ], async () => ticket, 100)
  await vi.advanceTimersByTimeAsync(100)
  expect(await result).toBe(ticket)
})

it('rejects for the retry screen if the bridge also never responds', async () => {
  vi.useFakeTimers()
  const result = loadTicket([async () => null], () => new Promise<null>(() => {}), 100)
  const assertion = expect(result).rejects.toThrow('Ticket lookup timed out')
  await vi.advanceTimersByTimeAsync(100)
  await assertion
})
