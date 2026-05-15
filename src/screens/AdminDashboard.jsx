import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { LogOut, Download, MessageCircle, Star, Users, ChevronDown, ChevronUp, Check, X, AlertTriangle } from 'lucide-react'

export default function AdminDashboard() {
  const { signOut, user } = useAuth()
  const [feedback, setFeedback] = useState([])
  const [users, setUsers] = useState([])
  const [sessions, setSessions] = useState([])
  const [applications, setApplications] = useState([])
  const [expandedSession, setExpandedSession] = useState(null)
  const [sessionMessages, setSessionMessages] = useState({})
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [feedbackRes, usersRes, sessionsRes, applicationsRes] = await Promise.all([
      supabase.from('feedback').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('chat_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('signup_applications').select('*').order('created_at', { ascending: false }),
    ])
    setFeedback(feedbackRes.data || [])
    setUsers(usersRes.data || [])
    setSessions(sessionsRes.data || [])
    setApplications(applicationsRes.data || [])
    setLoading(false)
  }

  async function approveApplication(app) {
    // Admin manually approves an application that the AI flagged for review.
    // We can't create the auth user from the client (need service role),
    // so we mark it as admin-approved and the admin needs to create the user
    // manually OR re-trigger the vet function. For pilot simplicity, we just
    // mark the row and the admin shares pre-created creds out-of-band.
    const { error } = await supabase
      .from('signup_applications')
      .update({
        admin_decision: 'APPROVED',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', app.id)
    if (error) {
      alert('Could not update: ' + error.message)
      return
    }
    loadData()
  }

  async function rejectApplication(app) {
    const note = window.prompt('Reason for rejection (optional):') || null
    const { error } = await supabase
      .from('signup_applications')
      .update({
        admin_decision: 'REJECTED',
        admin_notes: note,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', app.id)
    if (error) {
      alert('Could not update: ' + error.message)
      return
    }
    loadData()
  }

  async function loadMessages(sessionId) {
    if (sessionMessages[sessionId]) {
      setExpandedSession(expandedSession === sessionId ? null : sessionId)
      return
    }
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    setSessionMessages((prev) => ({ ...prev, [sessionId]: data || [] }))
    setExpandedSession(sessionId)
  }

  function exportCSV(dataArray, filename) {
    if (!dataArray.length) return
    const headers = Object.keys(dataArray[0])
    const csv = [
      headers.join(','),
      ...dataArray.map((row) =>
        headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function getUserName(userId) {
    const u = users.find((p) => p.id === userId)
    return u ? `${u.first_name || 'Unknown'} (Gr ${u.grade || '?'})` : userId?.slice(0, 8)
  }

  const avgRating = feedback.length
    ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)
    : '—'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-navy px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-gold font-bold text-lg">Archie Admin</h1>
          <p className="text-white/60 text-xs">Pilot Dashboard</p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1 text-white/70 text-sm hover:text-white"
        >
          <LogOut size={16} /> Logout
        </button>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        {['overview', 'invites', 'feedback', 'sessions', 'users'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize ${
              tab === t ? 'text-navy border-b-2 border-gold' : 'text-gray-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {/* Overview tab */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={<Users size={20} />} label="Users" value={users.length} />
              <StatCard icon={<MessageCircle size={20} />} label="Sessions" value={sessions.length} />
              <StatCard icon={<Star size={20} />} label="Avg Rating" value={avgRating} />
              <StatCard icon={<MessageCircle size={20} />} label="Feedback" value={feedback.length} />
            </div>

            <div className="bg-white rounded-xl p-4 mt-4">
              <h3 className="text-navy font-semibold text-sm mb-3">Recent Feedback</h3>
              {feedback.slice(0, 5).map((f) => (
                <div key={f.id} className="border-b border-gray-100 last:border-0 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{getUserName(f.user_id)}</span>
                    <span className="text-gold text-sm">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span>
                  </div>
                  {f.what_worked && <p className="text-xs text-green-600 mt-1">+ {f.what_worked}</p>}
                  {f.what_frustrated && <p className="text-xs text-red-500 mt-1">- {f.what_frustrated}</p>}
                </div>
              ))}
              {feedback.length === 0 && <p className="text-gray-400 text-sm">No feedback yet.</p>}
            </div>
          </div>
        )}

        {/* Invites tab — applications from the AI vetting flow */}
        {tab === 'invites' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-navy font-bold">Signup Applications</h2>
              <button
                onClick={() => exportCSV(applications, 'archie-applications')}
                className="flex items-center gap-1 text-sm text-navy bg-gold/20 px-3 py-1.5 rounded-full"
              >
                <Download size={14} /> CSV
              </button>
            </div>
            {applications.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No applications yet.</p>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => {
                  const isPending = !app.admin_decision && app.ai_decision === 'NEEDS_REVIEW'
                  const decided = app.admin_decision || (app.ai_decision === 'APPROVED' ? 'AUTO-APPROVED' : app.ai_decision === 'REJECTED' ? 'AUTO-REJECTED' : null)
                  return (
                    <div key={app.id} className="bg-white rounded-xl p-4 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-navy">{app.email}</p>
                          <p className="text-xs text-gray-400">
                            {app.requested_role} · age {Math.floor((Date.now() - new Date(app.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} · {new Date(app.created_at).toLocaleString('en-ZA')}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                            decided === 'AUTO-APPROVED' || decided === 'APPROVED'
                              ? 'bg-green-100 text-green-700'
                              : decided === 'AUTO-REJECTED' || decided === 'REJECTED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gold/20 text-navy'
                          }`}
                        >
                          {decided || 'PENDING'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mb-2">
                        <span className="font-semibold">AI confidence:</span> {app.ai_confidence != null ? `${(app.ai_confidence * 100).toFixed(0)}%` : '—'}
                        {app.ai_reasoning && <p className="mt-1">{app.ai_reasoning}</p>}
                      </div>
                      {app.ai_red_flags && app.ai_red_flags.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-red-500 mb-2">
                          <AlertTriangle size={12} />
                          {app.ai_red_flags.join(', ')}
                        </div>
                      )}
                      <details className="text-xs text-gray-500 mb-2">
                        <summary className="cursor-pointer text-navy font-medium">Application details</summary>
                        <pre className="bg-gray-50 p-2 rounded mt-1 overflow-x-auto text-[10px]">{JSON.stringify(app.application_data, null, 2)}</pre>
                      </details>
                      {isPending && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => approveApplication(app)}
                            className="flex-1 flex items-center justify-center gap-1 text-sm bg-green-500 text-white py-1.5 rounded-lg font-medium"
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            onClick={() => rejectApplication(app)}
                            className="flex-1 flex items-center justify-center gap-1 text-sm bg-red-500 text-white py-1.5 rounded-lg font-medium"
                          >
                            <X size={14} /> Reject
                          </button>
                        </div>
                      )}
                      {app.admin_decision && (
                        <p className="text-xs text-gray-400 mt-2">
                          Admin: {app.admin_decision} {app.admin_notes ? `— ${app.admin_notes}` : ''}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Feedback tab */}
        {tab === 'feedback' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-navy font-bold">All Feedback</h2>
              <button
                onClick={() => exportCSV(feedback, 'archie-feedback')}
                className="flex items-center gap-1 text-sm text-navy bg-gold/20 px-3 py-1.5 rounded-full"
              >
                <Download size={14} /> CSV
              </button>
            </div>
            <div className="space-y-3">
              {feedback.map((f) => (
                <div key={f.id} className="bg-white rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-navy">{getUserName(f.user_id)}</span>
                    <span className="text-gold">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span>
                  </div>
                  {f.what_worked && (
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="text-green-600 font-medium">Worked:</span> {f.what_worked}
                    </p>
                  )}
                  {f.what_frustrated && (
                    <p className="text-sm text-gray-600">
                      <span className="text-red-500 font-medium">Frustrated:</span> {f.what_frustrated}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(f.created_at).toLocaleString('en-ZA')}
                  </p>
                </div>
              ))}
              {feedback.length === 0 && (
                <p className="text-gray-400 text-center py-8">No feedback collected yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Sessions tab */}
        {tab === 'sessions' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-navy font-bold">Chat Sessions</h2>
              <button
                onClick={() => exportCSV(sessions, 'archie-sessions')}
                className="flex items-center gap-1 text-sm text-navy bg-gold/20 px-3 py-1.5 rounded-full"
              >
                <Download size={14} /> CSV
              </button>
            </div>
            <div className="space-y-2">
              {sessions.map((s) => (
                <div key={s.id} className="bg-white rounded-xl overflow-hidden">
                  <button
                    onClick={() => loadMessages(s.id)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-navy">{getUserName(s.user_id)}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(s.created_at).toLocaleString('en-ZA')}
                      </p>
                    </div>
                    {expandedSession === s.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {expandedSession === s.id && sessionMessages[s.id] && (
                    <div className="border-t border-gray-100 px-4 py-3 space-y-2 max-h-64 overflow-y-auto">
                      {sessionMessages[s.id].map((m, i) => (
                        <div
                          key={i}
                          className={`text-xs px-3 py-2 rounded-lg ${
                            m.role === 'user'
                              ? 'bg-gold/10 text-navy ml-8'
                              : 'bg-navy/5 text-gray-700 mr-8'
                          }`}
                        >
                          <span className="font-semibold text-[10px] uppercase text-gray-400 block mb-0.5">
                            {m.role}
                          </span>
                          {m.content}
                        </div>
                      ))}
                      {sessionMessages[s.id].length === 0 && (
                        <p className="text-gray-400 text-xs">No messages.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-gray-400 text-center py-8">No sessions yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Users tab */}
        {tab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-navy font-bold">Pilot Users</h2>
              <button
                onClick={() => exportCSV(users, 'archie-users')}
                className="flex items-center gap-1 text-sm text-navy bg-gold/20 px-3 py-1.5 rounded-full"
              >
                <Download size={14} /> CSV
              </button>
            </div>
            <div className="space-y-2">
              {users.map((u) => {
                const userSessions = sessions.filter((s) => s.user_id === u.id).length
                const userFeedback = feedback.filter((f) => f.user_id === u.id)
                const userAvg = userFeedback.length
                  ? (userFeedback.reduce((sum, f) => sum + f.rating, 0) / userFeedback.length).toFixed(1)
                  : '—'
                return (
                  <div key={u.id} className="bg-white rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-navy">
                          {u.first_name || 'No name'}{' '}
                          <span className="text-gray-400 font-normal">
                            {u.role || 'student'} · Gr {u.grade || '—'}
                          </span>
                        </p>
                        <p className="text-xs text-gray-400">{u.primary_subject || 'No subject'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-navy font-medium">{userSessions} sessions</p>
                        <p className="text-xs text-gold">Avg: {userAvg} ★</p>
                      </div>
                    </div>
                  </div>
                )
              })}
              {users.length === 0 && (
                <p className="text-gray-400 text-center py-8">No users yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-white rounded-xl p-4 flex items-center gap-3">
      <div className="text-gold">{icon}</div>
      <div>
        <p className="text-xl font-bold text-navy">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  )
}
