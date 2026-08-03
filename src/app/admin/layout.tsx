import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = user.app_metadata?.role
  if (role !== 'agent' && role !== 'super_admin') redirect('/')

  const isSA = role === 'super_admin'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-52 bg-white border-r flex flex-col">
        <div className="px-4 py-4 border-b">
          <p className="font-semibold text-sm">Hostiggo Support</p>
          <p className="text-xs text-gray-500 capitalize">{role?.replace('_', ' ')}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 text-sm">
          <Link href="/admin/queue"       className="block px-3 py-2 rounded hover:bg-gray-100">Queue</Link>
          <Link href="/admin/my-assigned" className="block px-3 py-2 rounded hover:bg-gray-100">My Assigned</Link>
          {isSA && <>
            <Link href="/admin/escalations" className="block px-3 py-2 rounded hover:bg-gray-100">Escalations</Link>
            <Link href="/admin/kyc"         className="block px-3 py-2 rounded hover:bg-gray-100">KYC Review</Link>
            <Link href="/admin/analytics"   className="block px-3 py-2 rounded hover:bg-gray-100">Analytics</Link>
            <Link href="/admin/audit"       className="block px-3 py-2 rounded hover:bg-gray-100">Audit Log</Link>
          </>}
        </nav>
        <form action="/auth/signout" method="post" className="p-3 border-t">
          <button className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-black">Sign out</button>
        </form>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
