import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AuditPage() {
  const supabase = await createClient()

  type AuditRow = {
    id: string; created_at: string; action: string
    ticket_id: string | null; admin_id: string | null; new_value: unknown
  }
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200) as { data: AuditRow[] | null }

  const ACTION_COLOR: Record<string, string> = {
    ESCALATED:       'bg-red-100 text-red-700',
    REFUND_APPROVED: 'bg-green-100 text-green-700',
    REFUND_REJECTED: 'bg-orange-100 text-orange-700',
    TRANSFERRED:     'bg-blue-100 text-blue-700',
    STATUS_CHANGE:   'bg-gray-100 text-gray-700',
    REASSIGNED:      'bg-purple-100 text-purple-700',
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <h1 className="text-xl font-semibold mb-6">Audit Log</h1>

      {!logs?.length && <p className="text-gray-400">No audit entries yet.</p>}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Time','Action','Ticket','By','Details'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs?.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${ACTION_COLOR[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {log.ticket_id ? log.ticket_id.slice(0, 8) + '…' : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {log.admin_id ? log.admin_id.slice(0, 8) + '…' : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                  {log.new_value ? JSON.stringify(log.new_value) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
