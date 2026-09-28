import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Secondary DB linked via FDW to Admin Portal — tickets appear in admin queue
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://jhihqmkqvbwfniwculhk.supabase.co'
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoaWhxbWtxdmJ3Zm5pd2N1bGhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTM1NzgsImV4cCI6MjA3OTI4OTU3OH0.b7AUBFdFMK0XJo8Q3xMzruma60vyj-4CgMrKFPgMenk'

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
