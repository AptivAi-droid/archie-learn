import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Shield } from 'lucide-react'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email.trim(), password)

      // Wait briefly for AuthContext to load profile, then verify role
      await new Promise((r) => setTimeout(r, 700))

      const { supabase } = await import('../lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Could not load user.')

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.role !== 'admin') {
        // Not an admin — sign them out and reject
        await signOut()
        setError('This login is for administrators only. If you are a student, teacher, or parent, please use the main login page.')
        return
      }

      navigate('/admin')
    } catch (err) {
      const msg = (err.message || '').toLowerCase()
      if (msg.includes('invalid login') || msg.includes('invalid_credentials')) {
        setError('Email or password is incorrect.')
      } else {
        setError(err.message || 'Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-6 py-10">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-gold rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield size={28} className="text-navy" />
        </div>
        <h1 className="text-3xl font-bold text-white">Admin Console</h1>
        <p className="text-white/60 mt-2">Restricted access</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-100 text-sm p-3 rounded-lg" role="alert">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-white mb-1">Admin email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-12 px-4 bg-white/10 border-2 border-white/20 rounded-xl text-base text-white placeholder-white/40 focus:border-gold focus:outline-none"
            placeholder="admin@example.com"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 px-4 bg-white/10 border-2 border-white/20 rounded-xl text-base text-white placeholder-white/40 focus:border-gold focus:outline-none"
            placeholder="Your password"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-14 bg-gold text-navy text-lg font-bold rounded-xl active:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Verifying…' : 'Enter admin console'}
        </button>
      </form>

      <p className="text-xs text-white/40 mt-12 text-center max-w-xs">
        Non-admin users will be redirected. If you reached this page by accident, return to the{' '}
        <a href="/archie-learn/" className="text-gold underline">main site</a>.
      </p>
    </div>
  )
}
