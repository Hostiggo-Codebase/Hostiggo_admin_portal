export function ticketSourceLabel(source: 'website' | 'mobile', sequence: number): string {
  const safeSequence = Number.isInteger(sequence) && sequence > 0 ? sequence : 1
  return `${source === 'website' ? 'Website' : 'Mobile'} ${safeSequence}`
}

export function ticketSourceFromSubject(subject: string | null | undefined): 'website' | 'mobile' | null {
  const value = (subject || '').toLowerCase()
  if (/website|web support|web chat/.test(value)) return 'website'
  if (/app support|mobile|customer support|support request/.test(value)) return 'mobile'
  return null
}
