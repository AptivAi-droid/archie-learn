import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await signUp(email, password)
      // If Supabase returns a session, user is auto-confirmed
      if (data.session) {
        navigate('/setup')
      } else {
        // Email confirmation required
        setConfirmEmail(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (confirmEmail) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 bg-navy rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-gold text-2xl font-bold">A</span>
        </div>
        <h1 className="text-2xl font-bold text-navy text-center">Check your email</h1>
        <p className="text-gray-500 mt-3 text-center max-w-xs">
          We sent a confirmation link to <strong className="text-navy">{email}</strong>.
          Tap the link, then come back and log in.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="mt-8 w-full max-w-sm h-14 bg-navy text-white text-lg font-semibold rounded-xl active:opacity-90 transition-opacity"
        >
          Go to login
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-navy">Create your account</h1>
        <p className="text-gray-500 mt-2">Let's get you set up</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
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
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-navy mb-1">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none transition-colors"
            placeholder="At least 6 characters"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-14 bg-navy text-white text-lg font-semibold rounded-xl active:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>

      <p className="text-sm text-gray-400 mt-8">
        Already have an account?{' '}
        <a href="/login" className="text-gold font-medium underline">
          Log in
        </a>
      </p>
    </div>
  )
}
