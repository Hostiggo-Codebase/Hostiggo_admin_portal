import { afterEach, expect, it, vi } from 'vitest'
import { adjustAgentCount } from './agent-count'

afterEach(() => vi.restoreAllMocks())

it.each(['increment', 'decrement'] as const)('awaits the %s RPC builder without calling .catch()', async (direction) => {
  // Match the SDK: only .then exists; this is not a native Promise.
  const result = { then: vi.fn((resolve) => Promise.resolve(resolve({ error: null }))) }
  const rpc = vi.fn(() => result)
  await expect(adjustAgentCount({ rpc }, 'agent-id', direction)).resolves.toBeUndefined()
  expect(rpc).toHaveBeenCalledWith(`${direction}_agent_count`, { p_agent_id: 'agent-id' })
  expect(result.then).toHaveBeenCalledOnce()
})

it('does not fail a completed ticket action if the count RPC returns an error', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const rpc = vi.fn(async () => ({ error: { message: 'function unavailable' } }))
  await expect(adjustAgentCount({ rpc }, 'agent-id', 'increment')).resolves.toBeUndefined()
  expect(console.error).toHaveBeenCalledWith('Agent count update failed:', 'function unavailable')
})

it('does not fail a completed ticket action if the count RPC throws', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const rpc = vi.fn(async () => { throw new Error('network unavailable') })
  await expect(adjustAgentCount({ rpc }, 'agent-id', 'decrement')).resolves.toBeUndefined()
  expect(console.error).toHaveBeenCalledOnce()
})
