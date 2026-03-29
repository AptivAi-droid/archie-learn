import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://glfivzdteschyfvyllqw.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZml2emR0ZXNjaHlmdnlsbHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDE5MDMsImV4cCI6MjA4ODExNzkwM30.1LHIFSQmd2VY2DiyZQ2P5E-1k7LITcjHSgK1wCsNwsM'

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
