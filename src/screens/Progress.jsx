import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Progress() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [sessionCount, setSessionCount] = useState(0)
  const [lastSession, setLastSession] = useState(null)

  const name = profile?.first_name || 'Learner'
  const subject = profile?.primary_subject || 'Mathematics'

  useEffect(() => {
    fetchProgress()
  }, [])

  async function fetchProgress() {
    const { data, count } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setSessionCount(count || 0)
    if (data && data.length > 0) {
      setLastSession(new Date(data[0].created_at).toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }))
    }
  }

  const progressPercent = Math.min((sessionCount / 7) * 100, 100)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-navy px-4 py-4">
        <h1 className="text-white text-xl font-bold">Your progress, {name}</h1>
      </header>

      <div className="px-4 py-6 space-y-6">
        {/* Subject card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-navy text-lg font-bold">{subject}</h2>

          <div className="mt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Sessions completed</span>
              <span className="text-navy font-bold text-lg">{sessionCount}</span>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Topics covered this week</span>
                <span className="text-gray-400">{Math.round(progressPercent)}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {lastSession && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Last session</span>
                <span className="text-navy font-medium">{lastSession}</span>
              </div>
            )}
          </div>
        </div>

        {/* Motivational message */}
        <div className="bg-navy rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gold rounded-full flex items-center justify-center shrink-0">
              <span className="text-navy font-bold text-sm">A</span>
            </div>
            <p className="text-white text-base leading-relaxed">
              Keep showing up. Every session builds on the last.
            </p>
          </div>
        </div>

        {/* Continue button */}
        <button
          onClick={() => navigate('/chat')}
          className="w-full h-14 bg-gold text-navy text-lg font-bold rounded-xl active:opacity-90 transition-opacity"
        >
          Continue learning
        </button>
      </div>
    </div>
  )
}
