import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import * as api from '../lib/api'

const AuthContext = createContext({})

export function useAuth() {
  return useContext(AuthContext)
}

// Where a signed-in user belongs. Incomplete profiles go to /setup first.
export function homePathFor(profile) {
  if (!profile) return '/'
  if (profile.role === 'admin') return '/admin'
  if (!profile.setup_complete) return '/setup'
  if (profile.role === 'teacher') return '/teacher'
  if (profile.role === 'parent') return '/parent'
  return '/chat'
}

export function AuthProvider({ children }) {
  const [hasToken, setHasToken] = useState(() => !!api.getToken())
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)
  // True while the first GET /me after a page load is in flight
  const [booting, setBooting] = useState(() => !!api.getToken())
  // Set when the server rejected our token (401) so guards send the user to /login
  const [sessionExpired, setSessionExpired] = useState(false)
  const mountedRef = useRef(true)
  const loadSeqRef = useRef(0)

  const resetSession = useCallback(() => {
    loadSeqRef.current++
    setHasToken(false)
    setProfile(null)
    setProfileError(null)
  }, [])

  // GET /me. Latest call wins; a transient failure keeps any profile we already have.
  const loadProfile = useCallback(async () => {
    const seq = ++loadSeqRef.current
    if (!api.getToken()) {
      resetSession()
      return null
    }
    try {
      const { profile: p } = await api.me.get()
      if (!mountedRef.current || seq !== loadSeqRef.current) return p
      setProfile(p || null)
      setProfileError(null)
      return p
    } catch (err) {
      if (!mountedRef.current || seq !== loadSeqRef.current) return null
      if (err.status === 401) {
        // api.js already cleared the token and notified us
        return null
      }
      console.warn('loadProfile failed:', err.message)
      setProfileError(err)
      return null
    }
  }, [resetSession])

  useEffect(() => {
    mountedRef.current = true
    const unsubscribe = api.onUnauthorized(() => {
      if (!mountedRef.current) return
      setSessionExpired(true)
      resetSession()
    })
    if (api.getToken()) {
      loadProfile().finally(() => {
        if (mountedRef.current) setBooting(false)
      })
    }
    return () => {
      mountedRef.current = false
      unsubscribe()
    }
  }, [loadProfile, resetSession])

  // Minimal user object for screens that only need id/email
  const user = useMemo(
    () => (hasToken ? { id: profile?.id ?? null, email: profile?.email ?? null } : null),
    [hasToken, profile?.id, profile?.email]
  )

  const loading = booting || (hasToken && !profile && !profileError)

  // Store a token + profile returned by register / login / approved application
  const establishSession = useCallback((token, newProfile) => {
    api.setToken(token)
    loadSeqRef.current++
    setSessionExpired(false)
    setHasToken(true)
    setProfile(newProfile || null)
    setProfileError(null)
  }, [])

  async function signUp(email, password, dob) {
    const data = await api.auth.register({ email, password, dob })
    establishSession(data.token, data.profile)
    return data
  }

  async function signIn(email, password) {
    const data = await api.auth.login({ email, password })
    establishSession(data.token, data.profile)
    return data
  }

  async function signOut() {
    // Revoke server-side, but never make the learner wait on it
    if (api.getToken()) api.auth.logout().catch(() => {})
    api.clearToken()
    setSessionExpired(false)
    resetSession()
  }

  async function resetPasswordForEmail(email) {
    return api.auth.forgotPassword(email)
  }

  // With a reset token (from the emailed link) → POST /auth/password/reset;
  // otherwise a logged-in change → PUT /me/password (needs the current password).
  async function updatePassword(newPassword, { token, currentPassword } = {}) {
    if (token) return api.auth.resetPassword({ token, password: newPassword })
    // The server revokes every token on a password change and returns a fresh one.
    const data = await api.me.changePassword({ current_password: currentPassword, new_password: newPassword })
    if (data?.token) api.setToken(data.token)
    return data
  }

  async function saveProfile(fields) {
    const { profile: saved } = await api.me.updateProfile(fields)
    loadSeqRef.current++
    setProfile(saved)
    setProfileError(null)
    return saved
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      profileError,
      loading,
      sessionExpired,
      signUp,
      signIn,
      signOut,
      establishSession,
      saveProfile,
      resetPasswordForEmail,
      updatePassword,
      fetchProfile: loadProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
