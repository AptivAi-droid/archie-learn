import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Use a unique storage key for Archie Learn to avoid conflicts
const STORAGE_KEY = 'archie-learn-auth'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
