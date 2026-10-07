import { createClient } from '@supabase/supabase-js'

// Public Supabase credentials — anon key is safe to expose, security is enforced via RLS
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://glfivzdteschyfvyllqw.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZml2emR0ZXNjaHlmdnlsbHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDE5MDMsImV4cCI6MjA4ODExNzkwM30.1LHIFSQmd2VY2DiyZQ2P5E-1k7LITcjHSgK1wCsNwsM'

if (import.meta.env.PROD && (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY)) {
  console.error(
    '[Archie] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY were NOT set at build time — ' +
    'falling back to the hardcoded Supabase project. Set the GitHub Actions secrets ' +
    'so production points at the intended project.'
  )
}

// Capture recovery-link markers BEFORE createClient: detectSessionInUrl consumes
// and clears the URL hash, and ResetPassword is lazy-loaded so it mounts too late
// to see the hash or the one-off PASSWORD_RECOVERY event itself.
const RECOVERY_IN_URL = typeof window !== 'undefined' &&
  /(^|[#?&])type=recovery(&|$)/.test(`${window.location.hash}&${window.location.search}`)
let passwordRecoveryEvent = false

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Prod and dev share the github.io origin — keep their sessions separate
    storageKey: import.meta.env.BASE_URL.includes('/dev/') ? 'archie-learn-dev-auth' : 'archie-learn-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// Synchronous on purpose — never await Supabase calls inside onAuthStateChange
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') passwordRecoveryEvent = true
})

// True only when this page load came from a password-recovery link
export function isRecoveryFlow() {
  return RECOVERY_IN_URL || passwordRecoveryEvent
}

const NETWORK_ERROR_PATTERNS = ['failed to fetch', 'networkerror', 'timed out', 'err_name_not_resolved', 'load failed']

// Maps raw Supabase / network errors to messages a learner can act on.
export function friendlyError(err) {
  const raw = typeof err === 'string' ? err : err?.message || ''
  const msg = raw.toLowerCase()
  if (NETWORK_ERROR_PATTERNS.some((p) => msg.includes(p))) {
    return "Can't reach the Archie server. Check your internet connection and try again."
  }
  if (msg.includes('invalid login credentials')) {
    return "That email and password don't match. Try again or reset your password."
  }
  return raw || 'Something went wrong. Please try again.'
}
