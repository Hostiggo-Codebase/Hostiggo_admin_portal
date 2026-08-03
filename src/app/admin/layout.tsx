import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ThemeToggle } from '@/components/theme-toggle'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = user.app_metadata?.role
  if (role !== 'agent' && role !== 'super_admin' && role !== 'admin') redirect('/login')

  const isSA = role === 'super_admin' || role === 'admin'

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-bold text-lg text-slate-900 dark:text-white">Hostiggo</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Admin Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 text-sm overflow-y-auto">
          <Link
            href="/admin/queue"
            className="block px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            📋 Queue
          </Link>
          <Link
            href="/admin/my-assigned"
            className="block px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            👤 My Assigned
          </Link>
          {isSA && (
            <>
              <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
                <p className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Admin
                </p>
              </div>
              <Link
                href="/admin/escalations"
                className="block px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                🔥 Escalations
              </Link>
              <Link
                href="/admin/kyc"
                className="block px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✓ KYC Review
              </Link>
              <Link
                href="/admin/analytics"
                className="block px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                📊 Analytics
              </Link>
              <Link
                href="/admin/audit"
                className="block px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                📝 Audit Log
              </Link>
            </>
          )}
        </nav>

        <div className="p-4 space-y-3 border-t border-slate-200 dark:border-slate-800">
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
