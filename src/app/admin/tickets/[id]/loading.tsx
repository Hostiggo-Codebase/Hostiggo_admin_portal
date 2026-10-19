export default function TicketLoading() {
  return (
    <div role="status" aria-live="polite" className="flex h-full flex-col bg-white">
      <div className="border-b px-4 py-3 text-sm text-gray-500">Opening ticket…</div>
      <div aria-hidden="true" className="flex-1 animate-pulse space-y-4 p-6">
        <div className="h-4 w-48 rounded bg-gray-100" />
        <div className="h-16 w-2/3 rounded-lg bg-gray-100" />
        <div className="ml-auto h-16 w-1/2 rounded-lg bg-gray-100" />
      </div>
    </div>
  )
}
