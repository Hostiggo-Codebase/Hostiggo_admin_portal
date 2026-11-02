import { expect, it } from 'vitest'
import { ticketSourceFromSubject, ticketSourceLabel } from './ticket-source'

it('formats website and mobile sequence labels', () => {
  expect(ticketSourceLabel('website', 1)).toBe('Website 1')
  expect(ticketSourceLabel('mobile', 2)).toBe('Mobile 2')
})

it('recognizes source from legacy subjects', () => {
  expect(ticketSourceFromSubject('Website Support Chat')).toBe('website')
  expect(ticketSourceFromSubject('App Support Chat')).toBe('mobile')
  expect(ticketSourceFromSubject('Mobile app support chat issue')).toBe('mobile')
  expect(ticketSourceFromSubject('nothing')).toBeNull()
})
