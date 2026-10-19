type TicketLoader<T> = () => Promise<T | null>

async function withTimeout<T>(load: TicketLoader<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve().then(load),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Ticket lookup timed out')), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

// A missing/slow local row must not delay a ticket available in the app DB.
// Race successful rows, rather than responses: a fast null/error must not win.
export async function loadTicket<T>(
  directSources: TicketLoader<T>[],
  fallback: TicketLoader<T>,
  timeoutMs = 8_000,
): Promise<T | null> {
  try {
    return await Promise.any(directSources.map(async (load) => {
      const ticket = await withTimeout(load, timeoutMs)
      if (!ticket) throw new Error('Ticket not found in this source')
      return ticket
    }))
  } catch {
    // The bridge is only needed when neither direct database has the ticket.
    return withTimeout(fallback, timeoutMs)
  }
}
