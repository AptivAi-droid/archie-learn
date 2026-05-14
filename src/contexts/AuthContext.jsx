import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function useAuth() {
  return useContext(AuthContext)
}

// Timeout wrapper — never let a Supabase call hang the UI
function withTimeout(promise, ms, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ])
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    try {
      // maybeSingle() returns null instead of throwing on 0 rows
      const { data } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        4000,
        'loadProfile'
      )
      if (mountedRef.current) setProfile(data || null)
    } catch (err) {
      console.warn('loadProfile failed:', err.message)
      if (mountedRef.current) setProfile(null)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    // Hard deadline — never stay on loading longer than 8s
    const failsafe = setTimeout(() => {
      if (mountedRef.current) setLoading(false)
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
        if (mountedRef.current) setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null
        if (mountedRef.current) setUser(u)
        if (u) {
          await loadProfile(u.id)
        } else {
          if (mountedRef.current) setProfile(null)
        }
        if (mountedRef.current) setLoading(false)
      }
    )

    return () => {
      mountedRef.current = false
      clearTimeout(failsafe)
      subscription.unsubscribe()
    }
  }, [loadProfile])

  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/archie-learn/setup`,
      },
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  async function saveProfile(profileData) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        ...profileData,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) throw error
    setProfile(data)
    return data
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      saveProfile,
      fetchProfile: loadProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
