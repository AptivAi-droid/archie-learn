import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth, homePathFor } from '../contexts/AuthContext'
import { friendlyError } from '../lib/api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, sessionExpired } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const passwordResetNotice = location.state?.passwordReset

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { profile } = await signIn(email.trim(), password)
      navigate(homePathFor(profile), { replace: true })
    } catch (err) {
      // 401 carries the server's "That email and password don't match."
      setError(friendlyError(err))
      setLoading(false)
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

        {sessionExpired && !passwordResetNotice && !error && (
          <div className="bg-gold/10 text-navy text-sm p-3 rounded-lg" role="status">
            Your session has ended. Please log in again.
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg" role="alert">
            {error}
          </div>
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
            disabled={loading}
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
