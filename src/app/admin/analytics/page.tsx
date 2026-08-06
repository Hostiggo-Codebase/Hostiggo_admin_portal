import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const supabase = await createClient()

  type ResRow   = { priority_label: string | null; ticket_count: number | null; avg_resolution_minutes: number | null }
  type CatRow   = { category: string | null; ticket_count: number | null; resolved_count: number | null }
  type AgentRow = { admin_id: string | null; display_name: string | null; agent_status: string | null; active_chat_count: number | null; accepting_new_chats: boolean | null; total_assigned: number | null }
  type CsatRow  = { avg_rating: number | null; rated_count: number | null; five_star: number | null; four_plus: number | null }
  type SlaRow   = { priority_label: string | null; total: number | null; within_sla: number | null; breached: number | null }

  const [resolutionTime, byCategory, agentLoad, csat, slaBreach] = await Promise.all([
    supabase.from('analytics_resolution_time').select('*') as unknown as Promise<{ data: ResRow[] }>,
    supabase.from('analytics_tickets_by_category').select('*') as unknown as Promise<{ data: CatRow[] }>,
    supabase.from('analytics_agent_load').select('*') as unknown as Promise<{ data: AgentRow[] }>,
    supabase.from('analytics_csat').select('*').single() as unknown as Promise<{ data: CsatRow }>,
    supabase.from('analytics_sla_breach').select('*') as unknown as Promise<{ data: SlaRow[] }>,
  ])

  return (
    <div className="p-6 overflow-y-auto h-full">
      <h1 className="text-xl font-semibold mb-6">Analytics (last 30 days)</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* CSAT */}
        <div className="bg-white border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">CSAT</h2>
          {csat.data ? (
            <div className="space-y-1">
              <p className="text-3xl font-bold">{csat.data.avg_rating ?? '—'}<span className="text-lg text-gray-400">/5</span></p>
              <p className="text-sm text-gray-500">{csat.data.rated_count} rated · {csat.data.five_star} five-star</p>
            </div>
          ) : <p className="text-gray-400 text-sm">No data</p>}
        </div>

        {/* Resolution time */}
        <div className="bg-white border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Avg Resolution Time</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-400">
              <th className="pb-1">Priority</th><th className="pb-1">Tickets</th><th className="pb-1">Avg (min)</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {(resolutionTime.data ?? []).map(r => (
                <tr key={r.priority_label}>
                  <td className="py-1">{r.priority_label}</td>
                  <td className="py-1">{r.ticket_count}</td>
                  <td className="py-1">{r.avg_resolution_minutes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* SLA Breach */}
        <div className="bg-white border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">SLA Breach (First Response)</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-400">
              <th className="pb-1">Priority</th><th className="pb-1">Total</th><th className="pb-1">In SLA</th><th className="pb-1">Breached</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {(slaBreach.data ?? []).map(r => (
                <tr key={r.priority_label}>
                  <td className="py-1">{r.priority_label}</td>
                  <td className="py-1">{r.total}</td>
                  <td className="py-1 text-green-600">{r.within_sla}</td>
                  <td className="py-1 text-red-600">{r.breached}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* By category */}
        <div className="bg-white border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Tickets by Category</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-400">
              <th className="pb-1">Category</th><th className="pb-1">Total</th><th className="pb-1">Resolved</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {(byCategory.data ?? []).map(r => (
                <tr key={r.category}>
                  <td className="py-1">{r.category}</td>
                  <td className="py-1">{r.ticket_count}</td>
                  <td className="py-1">{r.resolved_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Agent load */}
        <div className="bg-white border rounded-lg p-5 col-span-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Agent Load (current)</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-400">
              <th className="pb-1">Agent</th><th className="pb-1">Status</th><th className="pb-1">Active</th><th className="pb-1">Accepting</th><th className="pb-1">Total Assigned</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {(agentLoad.data ?? []).map(r => (
                <tr key={r.admin_id}>
                  <td className="py-1">{r.display_name}</td>
                  <td className="py-1">
                    <span className={`text-xs font-medium ${r.agent_status === 'ONLINE' ? 'text-green-600' : 'text-gray-400'}`}>
                      {r.agent_status}
                    </span>
                  </td>
                  <td className="py-1">{r.active_chat_count}/2</td>
                  <td className="py-1">{r.accepting_new_chats ? 'Yes' : 'No'}</td>
                  <td className="py-1">{r.total_assigned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
