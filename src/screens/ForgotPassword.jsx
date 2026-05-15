import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const { resetPasswordForEmail } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await resetPasswordForEmail(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message || 'Could not send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-navy rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-gold text-2xl font-bold">A</span>
          </div>
          <h1 className="text-2xl font-bold text-navy">Check your email</h1>
          <p className="text-gray-500 mt-3">
            If an account exists for <strong className="text-navy break-all">{email}</strong>,
            we've sent you a link to reset your password.
          </p>
          <p className="text-xs text-gray-400 mt-3 leading-relaxed">
            Didn't get it? Check your spam folder. If you still don't see it after a few minutes,
            ask your pilot administrator to reset your password manually.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="mt-8 w-full h-14 bg-navy text-white text-lg font-semibold rounded-xl active:opacity-90 transition-opacity"
          >
            Back to login
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
        <h1 className="text-3xl font-bold text-navy">Reset your password</h1>
        <p className="text-gray-500 mt-2">Enter your email and we'll send you a reset link</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg" role="alert">
            {error}
          </div>
        )}

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
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full h-14 bg-navy text-white text-lg font-semibold rounded-xl active:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p className="text-sm text-gray-400 mt-8">
        Remember it now?{' '}
        <Link to="/login" className="text-gold font-medium underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
