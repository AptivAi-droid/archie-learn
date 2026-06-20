import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FEATURES } from '../lib/featureFlags'
import GoogleButton from '../components/GoogleButton'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const { signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const passwordResetNotice = location.state?.passwordReset

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { user } = await signIn(email.trim(), password)
      // AuthContext onAuthStateChange will load profile and the route guards will redirect
      navigate('/chat')
    } catch (err) {
      // Surface email-confirmation problems clearly — common Supabase default-mailer pain point
      const msg = (err.message || '').toLowerCase()
      if (msg.includes('not confirmed') || msg.includes('email_not_confirmed')) {
        setError(
          "Your email hasn't been confirmed yet. Please check your inbox (and spam folder) for a confirmation link from Supabase. If you never received one, contact your pilot administrator — your account can be confirmed manually."
        )
      } else if (msg.includes('invalid login') || msg.includes('invalid_credentials')) {
        setError('Email or password is incorrect. Please try again.')
      } else {
        setError(err.message || 'Sign in failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      // Redirect happens via OAuth flow — browser navigates away
    } catch (err) {
      const msg = (err.message || '').toLowerCase()
      if (msg.includes('provider is not enabled') || msg.includes('unsupported provider') || msg.includes('validation_failed')) {
        setError("Google sign-in isn't available yet. Please use your email and password for now.")
      } else {
        setError(err.message || 'Google sign-in failed. Please try again.')
      }
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="text-center mb-10">
        <div className="w-14 h-14 bg-navy rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-gold text-xl font-bold">A</span>
        </div>
        <h1 className="text-3xl font-bold text-navy">Welcome back</h1>
        <p className="text-gray-500 mt-2">Log in to continue learning</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {passwordResetNotice && !error && (
          <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg" role="status">
            Password updated. Please log in with your new password.
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg" role="alert">
            {error}
          </div>
        )}

        {/* Google OAuth — shown via FEATURES.GOOGLE_OAUTH; needs the Google provider enabled in Supabase */}
        {FEATURES.GOOGLE_OAUTH && (
          <GoogleButton onClick={handleGoogle} loading={googleLoading} disabled={loading} />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none transition-colors"
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="block text-sm font-medium text-navy">Password</label>
              <Link to="/forgot-password" className="text-xs text-gold font-medium hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none transition-colors"
              placeholder="Your password"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full h-14 bg-navy text-white text-lg font-semibold rounded-xl active:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
      </div>

      <p className="text-sm text-gray-400 mt-8">
        Don't have an account?{' '}
        <Link to="/" className="text-gold font-medium underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
