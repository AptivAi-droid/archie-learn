import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { user } = await signIn(email, password)
      const { data: prof } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      navigate(prof?.role === 'admin' ? '/admin' : '/chat')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-navy">Welcome back</h1>
        <p className="text-gray-500 mt-2">Log in to continue learning</p>
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none transition-colors"
            placeholder="Your password"
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

      <p className="text-sm text-gray-400 mt-8">
        Don't have an account?{' '}
        <a href="/" className="text-gold font-medium underline">
          Sign up
        </a>
      </p>
    </div>
  )
}
