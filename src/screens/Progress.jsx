import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { MessageCircle, BookOpen, Target, Flame } from 'lucide-react'

export default function Progress() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const name = profile?.first_name || 'Learner'

  useEffect(() => {
    fetchProgress()
  }, [user])

  async function fetchProgress() {
    if (!user) return
    setLoading(true)

    try {
      const now = new Date()
      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 7)

      const [sessionsRes, answersRes, weekSessionsRes] = await Promise.all([
        supabase
          .from('chat_sessions')
          .select('created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('user_answers')
          .select('ai_score, max_marks, answered_at, question_id')
          .eq('user_id', user.id)
          .order('answered_at', { ascending: false }),

        supabase
          .from('chat_sessions')
          .select('created_at', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', weekAgo.toISOString()),
      ])

      const sessions = sessionsRes.data || []
      const answers = answersRes.data || []
      const weeklyCount = weekSessionsRes.count || 0

      // Streak calculation
      const streak = calcStreak(sessions)

      // Practice score
      const totalScore = answers.reduce((s, a) => s + (a.ai_score || 0), 0)
      const totalMax = answers.reduce((s, a) => s + (a.max_marks || 0), 0)
      const avgPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null

      // Last session date
      const lastDate = sessions.length > 0
        ? new Date(sessions[0].created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' })
        : null

      setStats({
        totalSessions: sessions.length,
        weeklySessions: weeklyCount,
        streak,
        totalAnswers: answers.length,
        avgPct,
        lastDate,
      })
    } catch (err) {
      console.error('Failed to load progress:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-navy px-4 py-4">
        <h1 className="text-white text-xl font-bold">Your Progress</h1>
        <p className="text-gold text-sm mt-0.5">{name}, keep building that streak!</p>
      </header>

      <div className="px-4 py-6 space-y-4">
        {loading ? (
          <ProgressSkeleton />
        ) : (
          <>
            {/* Streak banner */}
            {stats?.streak > 0 && (
              <div className="bg-gold rounded-2xl p-4 flex items-center gap-3">
                <Flame size={28} className="text-navy shrink-0" />
                <div>
                  <p className="text-navy font-bold text-lg">{stats.streak}-day streak!</p>
                  <p className="text-navy/70 text-sm">You've studied {stats.streak} day{stats.streak !== 1 ? 's' : ''} in a row.</p>
                </div>
              </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<MessageCircle size={20} />}
                value={stats?.totalSessions ?? 0}
                label="Total sessions"
                sub={stats?.weeklySessions > 0 ? `${stats.weeklySessions} this week` : null}
              />
              <StatCard
                icon={<Flame size={20} />}
                value={stats?.streak ?? 0}
                label="Day streak"
                sub={stats?.lastDate ? `Last: ${stats.lastDate}` : null}
              />
              <StatCard
                icon={<Target size={20} />}
                value={stats?.totalAnswers ?? 0}
                label="Questions done"
                sub={stats?.avgPct !== null ? `${stats.avgPct}% avg score` : null}
              />
              <StatCard
                icon={<BookOpen size={20} />}
                value={stats?.avgPct !== null ? `${stats.avgPct}%` : '—'}
                label="Practice avg"
                sub={stats?.totalAnswers > 0 ? `${stats.totalAnswers} answered` : 'Start practising!'}
              />
            </div>

            {/* Practice score bar */}
            {stats?.avgPct !== null && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex justify-between mb-2">
                  <h3 className="text-navy font-bold text-sm">Practice performance</h3>
                  <span className="text-gold font-bold text-sm">{stats.avgPct}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      stats.avgPct >= 70 ? 'bg-green-500' : stats.avgPct >= 50 ? 'bg-gold' : 'bg-red-400'
                    }`}
                    style={{ width: `${stats.avgPct}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {stats.avgPct >= 80
                    ? 'Excellent — you are on top of the material!'
                    : stats.avgPct >= 60
                    ? 'Good progress — keep practising to push past 80%.'
                    : 'Keep going — consistent practice will improve your score.'}
                </p>
              </div>
            )}

            {/* Archie's note */}
            <div className="bg-navy rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gold rounded-full flex items-center justify-center shrink-0">
                  <span className="text-navy font-bold text-sm">A</span>
                </div>
                <p className="text-white text-base leading-relaxed">
                  {stats?.totalSessions === 0
                    ? `Hey ${name}! Start your first chat session to begin building your progress.`
                    : stats?.totalSessions < 5
                    ? `Great start, ${name}! ${stats.totalSessions} sessions in. Consistency is everything — keep showing up.`
                    : `You've had ${stats?.totalSessions} sessions, ${name}. That's the kind of work that shows up in your results.`}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/chat')}
                className="h-14 bg-gold text-navy text-base font-bold rounded-xl active:opacity-90 transition-opacity"
              >
                Chat with Archie
              </button>
              <button
                onClick={() => navigate('/practice')}
                className="h-14 bg-white border-2 border-navy text-navy text-base font-bold rounded-xl active:opacity-90 transition-opacity"
              >
                Practice now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function calcStreak(sessions) {
  if (!sessions.length) return 0

  const days = new Set(
    sessions.map((s) => new Date(s.created_at).toDateString())
  )

  let streak = 0
  const today = new Date()
  let check = new Date(today)

  while (days.has(check.toDateString())) {
    streak++
    check.setDate(check.getDate() - 1)
  }

  return streak
}

function StatCard({ icon, value, label, sub }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="text-gold mb-2">{icon}</div>
      <p className="text-2xl font-bold text-navy">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function ProgressSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-20 bg-gray-200 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-2xl" />
        ))}
      </div>
      <div className="h-28 bg-gray-200 rounded-2xl" />
    </div>
  )
}
