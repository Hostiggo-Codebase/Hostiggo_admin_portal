import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate } from '@/lib/utils'
import type { TicketStatus } from '@/types/app'

export const dynamic = 'force-dynamic'

export default async function SupportPage() {
  const supabase = await createClient()

  type TicketRow = {
    ticket_id: string; ticket_number: string | null; subject: string
    status: string; priority_label: string; created_at: string; rating: number | null
    complaint_categories: { name: string } | null
  }
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('ticket_id, ticket_number, subject, status, priority_label, created_at, rating, complaint_categories(name)')
    .order('created_at', { ascending: false }) as { data: TicketRow[] | null }

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-gradient-to-b from-blue-100 to-transparent blur-3xl opacity-50 pointer-events-none" />

      <div className="relative max-w-4xl mx-auto py-12 px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">My Tickets</h1>
            <p className="text-slate-500 mt-1">Manage your support requests and KYC verifications.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/support/kyc"
              className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]"
            >
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              ID Verification
            </Link>
            <Link
              href="/support/new"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 hover:from-blue-500 hover:to-indigo-500 transition-all active:scale-[0.98]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Complaint
            </Link>
          </div>
        </div>

        {!tickets?.length ? (
          <div className="relative overflow-hidden bg-white/60 backdrop-blur-xl border border-slate-200 rounded-3xl p-12 text-center shadow-sm">
            <div className="absolute inset-0 bg-gradient-to-b from-white/50 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="w-20 h-20 mx-auto bg-blue-50 rounded-full flex items-center justify-center mb-5">
                <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No tickets yet</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">You haven't raised any complaints or support requests. When you do, they will appear here.</p>
              <Link href="/support/new" className="inline-flex items-center justify-center bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm">
                Raise your first complaint
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {tickets.map(t => (
              <Link key={t.ticket_id} href={`/support/tickets/${t.ticket_id}`} className="group relative block bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity pointer-events-none" />
                <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono font-medium text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">{t.ticket_number}</span>
                      <StatusBadge status={t.status as TicketStatus} />
                      {t.rating && (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                          <span>★</span> {t.rating}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">{t.subject}</h3>
                    <div className="flex items-center gap-2 mt-1.5 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        {(t.complaint_categories as { name: string } | null)?.name}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
                        {t.priority_label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-slate-400 font-medium">
                    {formatDate(t.created_at)}
                    <svg className="w-5 h-5 ml-3 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
