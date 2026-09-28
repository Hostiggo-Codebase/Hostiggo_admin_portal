import { createClient } from '@supabase/supabase-js'

// The mobile/dummy application writes tickets to this project. Keep the
// configuration in one place so every admin fallback reads the same database.
const secondaryUrl =
  process.env.SECONDARY_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SECONDARY_SUPABASE_URL
const secondaryAnonKey =
  process.env.SECONDARY_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SECONDARY_SUPABASE_ANON_KEY

if (!secondaryUrl || !secondaryAnonKey) {
  throw new Error('Secondary Supabase configuration is missing')
}

export const secondaryClient = createClient(secondaryUrl, secondaryAnonKey)
