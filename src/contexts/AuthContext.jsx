import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function useAuth() {
  return useContext(AuthContext)
}

// Timeout wrapper — never let a Supabase call hang the UI
export function withTimeout(promise, ms, label = 'operation') {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

export const AUTH_TIMEOUT_MS = 10000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)
  // User id whose profile load last resolved (success or error). Until it matches
  // the current user we keep `loading` true so guards never flash to /setup.
  const [profileFor, setProfileFor] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const mountedRef = useRef(true)
  const loadSeqRef = useRef(0)

  const loadProfile = useCallback(async (userId) => {
    const seq = ++loadSeqRef.current
    if (!userId) {
      setProfile(null)
      setProfileError(null)
      setProfileFor(null)
      return
    }
    try {
      // maybeSingle() returns null instead of throwing on 0 rows
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        AUTH_TIMEOUT_MS,
        'loadProfile'
      )
      if (error) throw error
      // Latest call wins — ignore stale responses
      if (!mountedRef.current || seq !== loadSeqRef.current) return
      setProfile(data || null)
      setProfileError(null)
      setProfileFor(userId)
    } catch (err) {
      console.warn('loadProfile failed:', err.message)
      if (!mountedRef.current || seq !== loadSeqRef.current) return
      // Never overwrite a good profile with null on a transient error —
      // only drop it if it belongs to a different user.
      setProfile((prev) => (prev?.id === userId ? prev : null))
      setProfileError(err)
      setProfileFor(userId)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    // Hard deadline — never stay on the initial session check longer than 8s
    const failsafe = setTimeout(() => {
      if (mountedRef.current) setSessionLoading(false)
    }, 8000)

    // Initial session check
    withTimeout(supabase.auth.getSession(), 5000, 'getSession')
      .then(async ({ data: { session } }) => {
        const u = session?.user ?? null
        if (mountedRef.current) setUser(u)
        if (u) await loadProfile(u.id)
      })
      .catch((err) => console.warn('getSession failed:', err.message))
      .finally(() => {
        if (mountedRef.current) setSessionLoading(false)
      })

    // IMPORTANT: this callback must stay synchronous. supabase-js runs it while
    // holding its auth lock; awaiting another Supabase call here (which needs the
    // same lock) deadlocks on TOKEN_REFRESHED / reload. Defer DB work instead.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mountedRef.current) return
        const u = session?.user ?? null
        setUser(u)
        if (!u) {
          loadSeqRef.current++
          setProfile(null)
          setProfileError(null)
          setProfileFor(null)
          return
        }
        // A token refresh doesn't change the profile — skip the extra round-trip
        if (event === 'TOKEN_REFRESHED') return
        setTimeout(() => loadProfile(u.id), 0)
      }
    )

    return () => {
      mountedRef.current = false
      clearTimeout(failsafe)
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const loading = sessionLoading || (!!user && profileFor !== user.id)

  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}login`,
      },
    })
    if (error) throw error
    return data
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function resetPasswordForEmail(email) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}reset-password`,
    })
    if (error) throw error
    return data
  }

  async function updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    return data
  }

  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}setup`,
      },
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    loadSeqRef.current++
    setUser(null)
    setProfile(null)
    setProfileError(null)
    setProfileFor(null)
  }

  // Store a freshly saved profile and cancel any in-flight (now stale) load
  function applySavedProfile(saved) {
    loadSeqRef.current++
    setProfile(saved)
    setProfileError(null)
    setProfileFor(saved?.id ?? user?.id ?? null)
  }

  async function saveProfile(profileData) {
    const payload = {
      id: user.id,
      ...profileData,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload)
      .select()
      .single()

    if (error) {
      // If schema is missing a column (e.g. last_name/school/subjects), retry with core fields only
      if (error.message?.includes('schema cache') || error.code === 'PGRST204') {
        const coreFields = ['id', 'first_name', 'role', 'grade', 'primary_subject', 'updated_at']
        const corePayload = Object.fromEntries(
          Object.entries(payload).filter(([k]) => coreFields.includes(k))
        )
        const retry = await supabase
          .from('profiles')
          .upsert(corePayload)
          .select()
          .single()
        if (retry.error) throw retry.error
        applySavedProfile(retry.data)
        return retry.data
      }
      throw error
    }

    applySavedProfile(data)
    return data
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      profileError,
      loading,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      saveProfile,
      resetPasswordForEmail,
      updatePassword,
      fetchProfile: loadProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
