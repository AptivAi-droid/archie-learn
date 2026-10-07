import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { friendlyError } from '../lib/api'

// Computes age in years from an ISO yyyy-mm-dd string
function computeAge(dobIso) {
  if (!dobIso) return null
  const dob = new Date(dobIso)
  if (Number.isNaN(dob.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [dob, setDob] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const age = useMemo(() => computeAge(dob), [dob])
  const isAdult = age !== null && age >= 18

  function goToApply() {
    navigate('/apply', { state: { email: email.trim(), password, dob } })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (age === null) {
      setError('Please enter your date of birth.')
      return
    }
    if (age < 13) {
      setError('Sorry — Archie Learn is for learners aged 13 and older.')
      return
    }
    if (isAdult) {
      // Route adults to the application flow
      goToApply()
      return
    }

    setLoading(true)
    try {
      // Registration logs the learner in immediately (no email confirmation step)
      await signUp(email.trim(), password, dob)
      navigate('/setup', { replace: true })
    } catch (err) {
      setLoading(false)
      if (err.status === 422 && err.code === 'ADULT') {
        goToApply()
      } else if (err.status === 409) {
        setError('That email is already registered. Try logging in instead.')
      } else {
        setError(friendlyError(err))
      }
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-navy rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-gold text-xl font-bold">A</span>
        </div>
        <h1 className="text-3xl font-bold text-navy">Sign up as a student</h1>
        <p className="text-gray-500 mt-2">Quick — only a few details to get started</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg" role="alert">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none"
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none"
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-1">Date of birth</label>
            <input
              type="date"
              required
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none"
            />
            {age !== null && isAdult && (
              <p className="text-xs text-gold mt-1.5">
                You're {age} — adults need a separate application. Click below to continue.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-navy text-white text-lg font-semibold rounded-xl active:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading
              ? 'Creating account…'
              : isAdult
              ? 'Continue to teacher / parent application →'
              : 'Sign up'}
          </button>
        </form>

        <div className="text-center text-xs text-gray-400 leading-relaxed pt-2">
          Teacher or parent?{' '}
          <Link to="/apply" className="text-gold font-medium underline">
            Apply for an adult account
          </Link>
        </div>
      </div>

      <p className="text-sm text-gray-400 mt-8">
        Already have an account?{' '}
        <Link to="/login" className="text-gold font-medium underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
