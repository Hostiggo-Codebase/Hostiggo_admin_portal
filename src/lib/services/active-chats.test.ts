import { describe, expect, it } from 'vitest'
import { buildActiveChats, isOpenStatus } from './active-chats'

const customers = new Map([['u1', { name: 'Asha Rao', email: 'asha@example.com' }]])
const admins = new Map([['a1', { name: 'Riya Agent', email: null }]])

describe('buildActiveChats', () => {
  it('keeps only open tickets and drops resolved/closed ones', () => {
    const rows = buildActiveChats([
      { ticket_id: 't1', status: 'ACTIVE', user_id: 'u1', assigned_agent_id: 'a1' },
      { ticket_id: 't2', status: 'RESOLVED', user_id: 'u1', assigned_agent_id: 'a1' },
      { ticket_id: 't3', status: 'CLOSED', user_id: 'u1' },
    ], customers, admins)
    expect(rows.map(r => r.ticket_id)).toEqual(['t1'])
  })

  it('resolves the customer and the assigned admin', () => {
    const [row] = buildActiveChats(
      [{ ticket_id: 't1', status: 'ASSIGNED', user_id: 'u1', assigned_agent_id: 'a1' }],
      customers, admins,
    )
    expect(row.customer).toEqual({ id: 'u1', name: 'Asha Rao', email: 'asha@example.com' })
    expect(row.admin).toEqual({ id: 'a1', name: 'Riya Agent' })
  })

  it('leaves admin null when unassigned and falls back to short ids when names are unknown', () => {
    const [row] = buildActiveChats(
      [{ ticket_id: 't1', status: 'QUEUED', user_id: 'abcdef1234567890' }],
      customers, admins,
    )
    expect(row.admin).toBeNull()
    expect(row.customer.name).toBe('Customer abcdef12')

    const [orphan] = buildActiveChats(
      [{ ticket_id: 't2', status: 'ACTIVE', assigned_agent_id: 'zzzzzzzz-1' }],
      customers, admins,
    )
    expect(orphan.admin?.name).toBe('Admin zzzzzzzz')
    expect(orphan.customer.name).toBe('Unknown customer')
  })

  it('dedupes by ticket id and sorts by priority then age', () => {
    const rows = buildActiveChats([
      { ticket_id: 'old-low', status: 'ACTIVE', priority: 4, created_at: '2026-01-01T00:00:00Z' },
      { ticket_id: 'new-urgent', status: 'ACTIVE', priority: 1, created_at: '2026-01-03T00:00:00Z' },
      { ticket_id: 'new-low', status: 'ACTIVE', priority: 4, created_at: '2026-01-02T00:00:00Z' },
      { id: 'new-low', status: 'ACTIVE', priority: 4, created_at: '2026-01-02T00:00:00Z' },
    ], customers, admins)
    expect(rows.map(r => r.ticket_id)).toEqual(['new-urgent', 'old-low', 'new-low'])
  })
})

describe('isOpenStatus', () => {
  it('rejects terminal and missing statuses', () => {
    expect(isOpenStatus('WAITING_ON_USER')).toBe(true)
    expect(isOpenStatus('DEFERRED')).toBe(false)
    expect(isOpenStatus(undefined)).toBe(false)
  })
})
