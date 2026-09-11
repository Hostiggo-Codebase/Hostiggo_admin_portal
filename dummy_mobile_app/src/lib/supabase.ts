import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vbqwitfzrglqojiijtmu.supabase.co'
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZicXdpdGZ6cmdscW9qaWlqdG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMzU0MTEsImV4cCI6MjEwNDYxMTQxMX0.9EkrIrSKCU0KHsQBEAGT1koL852XuKUPKknEU7CTx0s'

// SSR-safe storage adapter for Expo Router Web & Native
const SSRSafeStorage = {
  getItem: async (key: string) => {
    if (typeof window === 'undefined') return null
    return AsyncStorage.getItem(key)
  },
  setItem: async (key: string, value: string) => {
    if (typeof window === 'undefined') return
    return AsyncStorage.setItem(key, value)
  },
  removeItem: async (key: string) => {
    if (typeof window === 'undefined') return
    return AsyncStorage.removeItem(key)
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SSRSafeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
