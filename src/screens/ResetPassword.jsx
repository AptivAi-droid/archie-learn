import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, withTimeout, AUTH_TIMEOUT_MS } from '../contexts/AuthContext'
import { supabase, friendlyError, isRecoveryFlow } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasRecoverySession, setHasRecoverySession] = useState(null)
  const { updatePassword, signOut } = useAuth()
  const navigate = useNavigate()

  // Supabase puts a recovery token in the URL hash and exchanges it for a session.
  // Only a *recovery* session counts — an ordinary logged-in session must not be
  // able to change the password from this screen.
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setHasRecoverySession(true)
      }
    })

    // Also check immediately
    withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS, 'getSession')
      .then(({ data: { session } }) => {
        setHasRecoverySession((prev) => prev === true || (!!session && isRecoveryFlow()))
      })
      .catch((err) => {
        console.warn('ResetPassword getSession failed:', err.message)
        setHasRecoverySession((prev) => prev === true)
      })

    return () => sub.data.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await updatePassword(password)
      // Sign out so the user has to log in fresh with the new password
      await signOut()
      navigate('/login', { state: { passwordReset: true } })
    } catch (err) {
      setError(err.message ? friendlyError(err) : 'Could not update password. Please request a new reset link.')
    } finally {
      setLoading(false)
    }
  }

  if (hasRecoverySession === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400 text-sm">Checking reset link…</p>
      </div>
    )
  }

  if (hasRecoverySession === false) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-navy rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-gold text-2xl font-bold">A</span>
          </div>
          <h1 className="text-2xl font-bold text-navy">This reset link is invalid or has expired</h1>
          <p className="text-gray-500 mt-3">
            Password reset links are only valid for one hour and can only be used once.
            Please request a new one.
          </p>
          <button
            onClick={() => navigate('/forgot-password')}
            className="mt-8 w-full h-14 bg-navy text-white text-lg font-semibold rounded-xl active:opacity-90 transition-opacity"
          >
            Request new reset link
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10">
      <div className="text-center mb-10">
        <div className="w-14 h-14 bg-navy rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-gold text-xl font-bold">A</span>
        </div>
        <h1 className="text-3xl font-bold text-navy">Set a new password</h1>
        <p className="text-gray-500 mt-2">Choose something you'll remember</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg" role="alert">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-navy mb-1">New password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none transition-colors"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-navy mb-1">Confirm new password</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none transition-colors"
            placeholder="Repeat the password"
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !password || !confirmPassword}
          className="w-full h-14 bg-navy text-white text-lg font-semibold rounded-xl active:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
