type AdminRow = {
  admin_id: string
  role: string
  display_name: string | null
}

export type AdminAccess = {
  adminId: string
  role: 'agent' | 'super_admin'
  displayName: string | null
}

export function normalizeAdminRole(role?: string | null): AdminAccess['role'] | null {
  const normalized = role?.toLowerCase()
  if (normalized === 'admin' || normalized === 'agent') return 'agent'
  if (normalized === 'super_admin') return 'super_admin'
  return null
}

export async function getAdminAccess(
  supabase: {
    from: (table: 'admin_users') => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: AdminRow | null; error: unknown }>
        }
      }
    }
  },
  userId: string
): Promise<AdminAccess | null> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('admin_id, role, display_name')
    .eq('admin_id', userId)
    .maybeSingle()

  if (error || !data) return null

  const role = normalizeAdminRole(data.role)
  if (!role) return null

  return {
    adminId: data.admin_id,
    role,
    displayName: data.display_name,
  }
}
