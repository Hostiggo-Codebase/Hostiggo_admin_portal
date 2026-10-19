import { afterEach, expect, it, vi } from 'vitest'
import { startQueueWatcher } from './queue-watcher.js'

let stop
afterEach(() => {
  stop?.()
  vi.useRealTimers()
})

it('notifies on direct inserts, updates and deletes, but ignores unchanged rows and ordering', async () => {
  vi.useFakeTimers()
  let rows = [{ ticket_id: 'a', status: 'QUEUED' }]
  const notify = vi.fn()
  stop = startQueueWatcher({ loadTickets: async () => rows, notify })
  await vi.advanceTimersByTimeAsync(0)
  expect(notify).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(2_000)
  expect(notify).toHaveBeenCalledTimes(1)
  rows = [...rows, { ticket_id: 'b', status: 'QUEUED' }]
  await vi.advanceTimersByTimeAsync(2_000)
  expect(notify).toHaveBeenCalledTimes(2)
  rows.reverse()
  await vi.advanceTimersByTimeAsync(2_000)
  expect(notify).toHaveBeenCalledTimes(2)
  rows = [{ ticket_id: 'b', status: 'ACTIVE' }, rows[1]]
  await vi.advanceTimersByTimeAsync(2_000)
  expect(notify).toHaveBeenCalledTimes(3)
  rows = []
  await vi.advanceTimersByTimeAsync(2_000)
  expect(notify).toHaveBeenCalledTimes(4)
})

it('recovers after a database failure and skips work without connected agents', async () => {
  vi.useFakeTimers()
  let connected = false
  const loadTickets = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue([])
  const notify = vi.fn()
  const onError = vi.fn()
  stop = startQueueWatcher({ loadTickets, notify, onError, shouldPoll: () => connected })
  await vi.advanceTimersByTimeAsync(0)
  expect(loadTickets).not.toHaveBeenCalled()
  connected = true
  await vi.advanceTimersByTimeAsync(2_000)
  expect(onError).toHaveBeenCalledTimes(1)
  expect(notify).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(2_000)
  expect(notify).toHaveBeenCalledTimes(1)
})

it('does not overlap slow reads or emit after shutdown', async () => {
  vi.useFakeTimers()
  let resolve
  const loadTickets = vi.fn(() => new Promise(done => { resolve = done }))
  const notify = vi.fn()
  stop = startQueueWatcher({ loadTickets, notify })
  await vi.advanceTimersByTimeAsync(10_000)
  expect(loadTickets).toHaveBeenCalledTimes(1)
  stop()
  resolve([])
  await vi.advanceTimersByTimeAsync(10_000)
  expect(notify).not.toHaveBeenCalled()
  expect(loadTickets).toHaveBeenCalledTimes(1)
})
