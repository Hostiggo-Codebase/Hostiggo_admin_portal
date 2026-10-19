// Supabase Realtime is disabled in this project. Watch persisted rows so writes
// from mobile apps and HTTP APIs also notify dashboards through Socket.io.
export function startQueueWatcher({ loadTickets, notify, shouldPoll = () => true, onError = console.error, intervalMs = 2_000 }) {
  let fingerprint
  let stopped = false
  let timer

  async function poll() {
    try {
      if (!shouldPoll()) return
      const tickets = await loadTickets()
      const next = JSON.stringify([...tickets].sort((a, b) => a.ticket_id.localeCompare(b.ticket_id)))
      if (!stopped && next !== fingerprint) {
        fingerprint = next
        notify()
      }
    } catch (error) {
      if (!stopped) onError(error)
    } finally {
      // Schedule after completion: a slow database must never overlap polls.
      if (!stopped) timer = setTimeout(poll, intervalMs)
    }
  }

  void poll()
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}
