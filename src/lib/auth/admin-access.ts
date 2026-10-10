import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

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

function parseEmailList(value?: string): string[] {
  return (value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

function getAllowedRole(email?: string | null): AdminAccess['role'] | null {
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail) return null

  const superAdminEmails = parseEmailList(process.env.ADMIN_SUPER_ADMIN_EMAILS)
  const agentEmails = [
    ...parseEmailList(process.env.ADMIN_AGENT_EMAILS),
    ...parseEmailList(process.env.ADMIN_ALLOWLIST_EMAILS),
  ]

  if (superAdminEmails.includes(normalizedEmail)) return 'super_admin'
  if (agentEmails.includes(normalizedEmail)) return 'agent'
  return null
}

function getDisplayName(user: User): string {
  const metadata = user.user_metadata || {}
  const name =
    typeof metadata.name === 'string'
      ? metadata.name
      : typeof metadata.full_name === 'string'
        ? metadata.full_name
        : ''

  return name.trim() || user.email || 'Hostiggo Admin'
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

export async function getOrProvisionAdminAccess(
  supabase: Parameters<typeof getAdminAccess>[0],
  user: User
): Promise<AdminAccess | null> {
  const existingAdmin = await getAdminAccess(supabase, user.id)
  if (existingAdmin) return existingAdmin

  const allowedRole = getAllowedRole(user.email)
  if (!allowedRole) return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const dbRole = allowedRole === 'super_admin' ? 'SUPER_ADMIN' : 'ADMIN'
  const payload = {
    admin_id: user.id,
    display_name: getDisplayName(user),
    role: dbRole,
    email: user.email,
    agent_status: 'ONLINE',
    accepting_new_chats: true,
  }

  const { error } = await serviceClient
    .from('admin_users')
    .upsert(payload, { onConflict: 'admin_id' })

  if (error) {
    console.error('Failed to provision allowed admin:', error.message)
    return null
  }

  return {
    adminId: user.id,
    role: allowedRole,
    displayName: payload.display_name,
  }
}
