import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function ParentView() {
  const { user, profile } = useAuth()
  const [sessionCount, setSessionCount] = useState(0)
  const [weekSessions, setWeekSessions] = useState(0)

  const name = profile?.first_name || 'Learner'
  const grade = profile?.grade || 10
  const subject = profile?.primary_subject || 'Mathematics'

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    // Total sessions
    const { count: total } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    setSessionCount(total || 0)

    // Sessions this week
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const { count: weekly } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', weekAgo.toISOString())

    setWeekSessions(weekly || 0)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-navy px-4 py-4">
        <h1 className="text-white text-xl font-bold">Weekly update for Parent</h1>
        <p className="text-gold text-sm mt-1">{name} — Grade {grade}</p>
      </header>

      <div className="px-4 py-6 space-y-4">
        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
            <p className="text-3xl font-bold text-navy">{weekSessions}</p>
            <p className="text-sm text-gray-500 mt-1">Sessions this week</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
            <p className="text-3xl font-bold text-navy">{Math.min(weekSessions * 2, 12)}</p>
            <p className="text-sm text-gray-500 mt-1">Topics practised</p>
          </div>
        </div>

        {/* Archie's note */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-navy rounded-full flex items-center justify-center shrink-0">
              <span className="text-gold font-bold text-sm">A</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-navy mb-1">Archie's note</p>
              <p className="text-base text-gray-700 leading-relaxed">
                Your learner is building strong habits.
                Consistency is the key — keep encouraging them.
              </p>
            </div>
          </div>
        </div>

        {/* Action prompt */}
        <div className="bg-gold/10 border-2 border-gold/30 rounded-2xl p-5">
          <p className="text-navy text-base leading-relaxed">
            Ask {name} to show you what they learned about {subject} this week.
          </p>
        </div>

        {/* Footer note */}
        <p className="text-center text-sm text-gray-400 mt-4">
          Full progress reports available in the premium plan.
        </p>
      </div>
    </div>
  )
}
