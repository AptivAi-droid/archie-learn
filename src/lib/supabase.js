import { createClient } from '@supabase/supabase-js'

// Public Supabase credentials — anon key is safe to expose, security is enforced via RLS
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://glfivzdteschyfvyllqw.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZml2emR0ZXNjaHlmdnlsbHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDE5MDMsImV4cCI6MjA4ODExNzkwM30.1LHIFSQmd2VY2DiyZQ2P5E-1k7LITcjHSgK1wCsNwsM'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'archie-learn-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
