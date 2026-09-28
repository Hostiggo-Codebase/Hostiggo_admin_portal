import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kqrzynfafnybdxnaugte.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtxcnp5bmZhZm55YmR4bmF1Z3RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNDc3MzYsImV4cCI6MjA5OTkyMzczNn0.Ke3c7_EPke22TH69v8nVsv6adQ5dz3-wz0ltncqTk1E'

export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
}
