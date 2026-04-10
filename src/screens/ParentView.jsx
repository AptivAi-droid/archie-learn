import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Link2, Users, MessageCircle, Target, LogOut } from 'lucide-react'

export default function ParentView() {
  const { user, profile, signOut } = useAuth()
  const [links, setLinks] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentStats, setStudentStats] = useState(null)
  const [linkCode, setLinkCode] = useState('')
  const [linkError, setLinkError] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)
  const [loadingLinks, setLoadingLinks] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)

  const parentName = profile?.first_name || 'Parent'

  useEffect(() => {
    fetchLinks()
  }, [user])

  useEffect(() => {
    if (selectedStudent) fetchStudentStats(selectedStudent.id)
  }, [selectedStudent])

  async function fetchLinks() {
    if (!user) return
    setLoadingLinks(true)
    const { data } = await supabase
      .from('parent_student_links')
      .select(`
        id,
        confirmed,
        student_id,
        profiles!parent_student_links_student_id_fkey (
          id, first_name, last_name, grade, primary_subject
        )
      `)
      .eq('parent_id', user.id)
      .eq('confirmed', true)

    const linked = (data || []).map((l) => l.profiles).filter(Boolean)
    setLinks(linked)
    if (linked.length > 0 && !selectedStudent) {
      setSelectedStudent(linked[0])
    }
    setLoadingLinks(false)
  }

  async function fetchStudentStats(studentId) {
    setLoadingStats(true)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const [sessionsRes, weekRes, answersRes] = await Promise.all([
      supabase
        .from('chat_sessions')
        .select('created_at')
        .eq('user_id', studentId)
        .order('created_at', { ascending: false })
        .limit(50),

      supabase
        .from('chat_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', studentId)
        .gte('created_at', weekAgo.toISOString()),

      supabase
        .from('user_answers')
        .select('ai_score, max_marks, answered_at')
        .eq('user_id', studentId)
        .order('answered_at', { ascending: false })
        .limit(50),
    ])

    const sessions = sessionsRes.data || []
    const answers = answersRes.data || []
    const weeklyCount = weekRes.count || 0

    const totalScore = answers.reduce((s, a) => s + (a.ai_score || 0), 0)
    const totalMax = answers.reduce((s, a) => s + (a.max_marks || 0), 0)
    const avgPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null

    setStudentStats({
      totalSessions: sessions.length,
      weeklySessions: weeklyCount,
      totalAnswers: answers.length,
      avgPct,
      lastActive: sessions.length > 0
        ? new Date(sessions[0].created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'No sessions yet',
    })
    setLoadingStats(false)
  }

  async function redeemCode() {
    const code = linkCode.trim().toUpperCase()
    if (code.length !== 6) {
      setLinkError('Please enter a 6-character code.')
      return
    }

    setLinkError('')
    setLinkLoading(true)

    try {
      // Look up the code
      const { data: codeRow, error: codeErr } = await supabase
        .from('link_codes')
        .select('*')
        .eq('code', code)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .single()

      if (codeErr || !codeRow) {
        setLinkError('Code not found or has expired. Ask your child for a new one.')
        return
      }

      // Create the link
      const { error: linkErr } = await supabase
        .from('parent_student_links')
        .upsert({
          parent_id: user.id,
          student_id: codeRow.student_id,
          confirmed: true,
        })

      if (linkErr) {
        setLinkError('Could not link account. Please try again.')
        return
      }

      // Mark code as used
      await supabase
        .from('link_codes')
        .update({ used: true })
        .eq('code', code)

      setLinkCode('')
      fetchLinks()
    } catch (err) {
      setLinkError('Something went wrong. Please try again.')
    } finally {
      setLinkLoading(false)
    }
  }

  if (loadingLinks) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="bg-navy px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Parent Dashboard</h1>
          <p className="text-gold text-sm mt-0.5">Hi, {parentName}</p>
        </div>
        <button
          onClick={signOut}
          className="text-white/70 flex items-center gap-1 text-sm hover:text-white transition-colors"
        >
          <LogOut size={16} /> Out
        </button>
      </header>

      <div className="px-4 py-6 space-y-5">
        {/* Student selector */}
        {links.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {links.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStudent(s)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border-2 transition-colors ${
                  selectedStudent?.id === s.id
                    ? 'bg-navy text-white border-navy'
                    : 'bg-white text-navy border-gray-200'
                }`}
              >
                {s.first_name}
              </button>
            ))}
          </div>
        )}

        {/* No linked students */}
        {links.length === 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <h2 className="text-navy font-bold text-lg mb-2">Link your child's account</h2>
            <p className="text-gray-500 text-sm mb-4">
              Ask your child to open Archie and share their 6-character link code with you.
            </p>
          </div>
        )}

        {/* Student stats */}
        {selectedStudent && (
          <>
            <div className="bg-navy rounded-2xl p-4">
              <p className="text-gold text-xs font-bold uppercase tracking-wide">Viewing progress for</p>
              <p className="text-white text-lg font-bold mt-0.5">
                {selectedStudent.first_name} {selectedStudent.last_name || ''}
              </p>
              <p className="text-white/60 text-sm">
                Grade {selectedStudent.grade} · {selectedStudent.primary_subject}
              </p>
            </div>

            {loadingStats ? (
              <div className="grid grid-cols-2 gap-3 animate-pulse">
                {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                    <p className="text-3xl font-bold text-navy">{studentStats?.weeklySessions ?? 0}</p>
                    <p className="text-sm text-gray-500 mt-1">Sessions this week</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                    <p className="text-3xl font-bold text-navy">{studentStats?.totalSessions ?? 0}</p>
                    <p className="text-sm text-gray-500 mt-1">Total sessions</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                    <p className="text-3xl font-bold text-navy">{studentStats?.totalAnswers ?? 0}</p>
                    <p className="text-sm text-gray-500 mt-1">Questions answered</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                    <p className="text-3xl font-bold text-navy">
                      {studentStats?.avgPct !== null ? `${studentStats.avgPct}%` : '—'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">Practice avg</p>
                  </div>
                </div>

                {/* Practice bar */}
                {studentStats?.avgPct !== null && (
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium text-navy">Practice performance</span>
                      <span className="text-sm font-bold text-gold">{studentStats.avgPct}%</span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          studentStats.avgPct >= 70 ? 'bg-green-500' :
                          studentStats.avgPct >= 50 ? 'bg-gold' : 'bg-red-400'
                        }`}
                        style={{ width: `${studentStats.avgPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Last active */}
                <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
                  <span className="text-sm text-gray-500">Last active</span>
                  <span className="text-sm font-medium text-navy">{studentStats?.lastActive}</span>
                </div>

                {/* Archie's note */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-navy rounded-full flex items-center justify-center shrink-0">
                      <span className="text-gold font-bold text-sm">A</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy mb-1">Archie's note</p>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {studentStats?.weeklySessions >= 3
                          ? `${selectedStudent.first_name} is showing great consistency — ${studentStats.weeklySessions} sessions this week. Keep encouraging them!`
                          : studentStats?.totalSessions > 0
                          ? `${selectedStudent.first_name} is making progress. Encourage them to aim for 3+ sessions per week for best results.`
                          : `${selectedStudent.first_name} is getting started. Encourage them to chat with Archie today!`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tip for parent */}
                <div className="bg-gold/10 border-2 border-gold/30 rounded-2xl p-4">
                  <p className="text-navy text-sm leading-relaxed">
                    Ask {selectedStudent.first_name} to explain one thing they learned in{' '}
                    {selectedStudent.primary_subject} this week — teaching it to you helps them remember it.
                  </p>
                </div>
              </>
            )}
          </>
        )}

        {/* Link code input — always visible */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={18} className="text-navy" />
            <h3 className="text-navy font-bold text-sm">
              {links.length === 0 ? 'Link a student account' : 'Link another student'}
            </h3>
          </div>
          {linkError && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-3" role="alert">
              {linkError}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={linkCode}
              onChange={(e) => setLinkCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="6-char code"
              maxLength={6}
              className="flex-1 h-12 px-4 border-2 border-gray-200 rounded-xl text-base text-center tracking-widest font-mono focus:border-navy focus:outline-none transition-colors uppercase"
            />
            <button
              onClick={redeemCode}
              disabled={linkLoading || linkCode.length < 6}
              className="px-5 h-12 bg-navy text-white font-semibold rounded-xl disabled:opacity-40 active:opacity-90 transition-opacity"
            >
              {linkLoading ? '…' : 'Link'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Ask your child to go to their Profile to generate a code.
          </p>
        </div>
      </div>
    </div>
  )
}
