import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

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
  const [confirmEmail, setConfirmEmail] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendNote, setResendNote] = useState('')
  const { signUp, signIn } = useAuth()
  const navigate = useNavigate()

  const age = useMemo(() => computeAge(dob), [dob])
  const isAdult = age !== null && age >= 18

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
      navigate('/apply', { state: { email: email.trim(), password, dob } })
      return
    }

    setLoading(true)
    try {
      const data = await signUp(email.trim(), password)

      // Try immediate sign-in (email confirmation should be disabled per pilot setup)
      try {
        if (!data.session) {
          await signIn(email.trim(), password)
        }
      } catch {
        // If signin fails, fall through to confirm screen
      }

      // Stash DOB in sessionStorage for ProfileSetup to pick up
      sessionStorage.setItem('archie-pending-dob', dob)
      navigate('/setup', { state: { roleHint: 'student', dob } })
    } catch (err) {
      const msg = (err.message || '').toLowerCase()
      if (msg.includes('already registered') || msg.includes('user already')) {
        setError('That email is already registered. Try logging in instead.')
      } else if (msg.includes('not confirmed') || msg.includes('email_not_confirmed')) {
        setConfirmEmail(true)
      } else {
        setError(err.message || 'Sign up failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setResending(true)
    setResendNote('')
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      })
      setResendNote(resendErr ? 'Could not resend right now.' : 'Confirmation email re-sent. Check spam too.')
    } catch {
      setResendNote('Could not resend right now.')
    } finally {
      setResending(false)
    }
  }

  if (confirmEmail) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-navy rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-gold text-2xl font-bold">A</span>
          </div>
          <h1 className="text-2xl font-bold text-navy">Check your email</h1>
          <p className="text-gray-500 mt-3">
            We sent a confirmation link to <strong className="text-navy break-all">{email}</strong>.
          </p>
          {resendNote && (
            <div className="bg-gold/10 text-navy text-sm p-3 rounded-lg mt-4">{resendNote}</div>
          )}
          <button
            onClick={handleResend}
            disabled={resending}
            className="mt-6 w-full h-12 bg-white border-2 border-navy text-navy font-semibold rounded-xl disabled:opacity-50"
          >
            {resending ? 'Sending…' : 'Resend confirmation email'}
          </button>
          <button
            onClick={() => navigate('/login')}
            className="mt-3 w-full h-14 bg-navy text-white text-lg font-semibold rounded-xl"
          >
            Go to login
          </button>
        </div>
      </div>
    )
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
