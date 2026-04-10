import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { SUBJECTS, GRADES } from '../data/subjects'
import { Plus, Users, Download, LogOut, ChevronRight, X, UserPlus } from 'lucide-react'

export default function TeacherDashboard() {
  const { user, profile, signOut } = useAuth()
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [students, setStudents] = useState([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [showCreateClass, setShowCreateClass] = useState(false)
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [tab, setTab] = useState('students')

  useEffect(() => {
    fetchClasses()
  }, [user])

  useEffect(() => {
    if (selectedClass) fetchStudents(selectedClass.id)
  }, [selectedClass])

  async function fetchClasses() {
    if (!user) return
    setLoadingClasses(true)
    const { data } = await supabase
      .from('teacher_classes')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })

    setClasses(data || [])
    if (data && data.length > 0 && !selectedClass) {
      setSelectedClass(data[0])
    }
    setLoadingClasses(false)
  }

  async function fetchStudents(classId) {
    setLoadingStudents(true)
    const { data: enrollments } = await supabase
      .from('class_enrollments')
      .select(`
        student_id,
        enrolled_at,
        profiles!class_enrollments_student_id_fkey (
          id, first_name, last_name, grade, primary_subject
        )
      `)
      .eq('class_id', classId)

    if (!enrollments) { setStudents([]); setLoadingStudents(false); return }

    const studentIds = enrollments.map((e) => e.profiles?.id).filter(Boolean)

    if (studentIds.length === 0) { setStudents([]); setLoadingStudents(false); return }

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const [sessionsRes, answersRes] = await Promise.all([
      supabase
        .from('chat_sessions')
        .select('user_id, created_at')
        .in('user_id', studentIds)
        .gte('created_at', weekAgo.toISOString()),

      supabase
        .from('user_answers')
        .select('user_id, ai_score, max_marks')
        .in('user_id', studentIds),
    ])

    const sessions = sessionsRes.data || []
    const answers = answersRes.data || []

    const enriched = enrollments.map((e) => {
      const p = e.profiles
      if (!p) return null
      const sSessions = sessions.filter((s) => s.user_id === p.id)
      const sAnswers = answers.filter((a) => a.user_id === p.id)
      const totalScore = sAnswers.reduce((s, a) => s + (a.ai_score || 0), 0)
      const totalMax = sAnswers.reduce((s, a) => s + (a.max_marks || 0), 0)
      return {
        ...p,
        weeklySessions: sSessions.length,
        totalAnswers: sAnswers.length,
        avgPct: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null,
      }
    }).filter(Boolean)

    setStudents(enriched)
    setLoadingStudents(false)
  }

  function exportStudentCSV() {
    if (!students.length) return
    const rows = students.map((s) => ({
      name: `${s.first_name} ${s.last_name || ''}`.trim(),
      grade: s.grade,
      subject: s.primary_subject,
      weekly_sessions: s.weeklySessions,
      practice_avg: s.avgPct !== null ? `${s.avgPct}%` : 'N/A',
    }))
    const headers = Object.keys(rows[0])
    const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '')}"`).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedClass?.class_name}-students.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const teacherName = profile?.first_name || 'Teacher'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-navy px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-gold font-bold text-lg">Teacher Dashboard</h1>
          <p className="text-white/60 text-xs">Hi, {teacherName}</p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1 text-white/70 text-sm hover:text-white transition-colors"
        >
          <LogOut size={16} /> Out
        </button>
      </header>

      {/* Class selector */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 overflow-x-auto">
        {loadingClasses ? (
          <div className="h-8 w-32 bg-gray-200 rounded-full animate-pulse" />
        ) : (
          <>
            {classes.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClass(c)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
                  selectedClass?.id === c.id
                    ? 'bg-navy text-white border-navy'
                    : 'bg-white text-navy border-gray-200'
                }`}
              >
                {c.class_name}
              </button>
            ))}
            <button
              onClick={() => setShowCreateClass(true)}
              className="shrink-0 flex items-center gap-1 px-4 py-1.5 rounded-full text-sm font-medium border-2 border-dashed border-gray-300 text-gray-500"
            >
              <Plus size={14} /> New class
            </button>
          </>
        )}
      </div>

      {classes.length === 0 && !loadingClasses ? (
        <EmptyState onCreateClass={() => setShowCreateClass(true)} />
      ) : selectedClass && (
        <div className="p-4 max-w-2xl mx-auto">
          {/* Class header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-navy font-bold text-lg">{selectedClass.class_name}</h2>
              <p className="text-gray-400 text-sm">
                {selectedClass.subject && `${selectedClass.subject} · `}
                {selectedClass.grade && `Grade ${selectedClass.grade} · `}
                {students.length} student{students.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddStudent(true)}
                className="flex items-center gap-1 text-sm text-navy bg-gold/20 px-3 py-1.5 rounded-full font-medium"
              >
                <UserPlus size={14} /> Add
              </button>
              {students.length > 0 && (
                <button
                  onClick={exportStudentCSV}
                  className="flex items-center gap-1 text-sm text-navy bg-gray-100 px-3 py-1.5 rounded-full font-medium"
                >
                  <Download size={14} /> CSV
                </button>
              )}
            </div>
          </div>

          {loadingStudents ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
              <Users size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">No students yet. Add students by their email address.</p>
              <button
                onClick={() => setShowAddStudent(true)}
                className="mt-4 px-6 py-2 bg-navy text-white text-sm font-semibold rounded-full"
              >
                Add first student
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {students.map((s) => (
                <StudentCard key={s.id} student={s} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create class modal */}
      {showCreateClass && (
        <CreateClassModal
          teacherId={user.id}
          onClose={() => setShowCreateClass(false)}
          onCreated={(newClass) => {
            setClasses((prev) => [newClass, ...prev])
            setSelectedClass(newClass)
            setShowCreateClass(false)
          }}
        />
      )}

      {/* Add student modal */}
      {showAddStudent && selectedClass && (
        <AddStudentModal
          classId={selectedClass.id}
          onClose={() => setShowAddStudent(false)}
          onAdded={() => {
            setShowAddStudent(false)
            fetchStudents(selectedClass.id)
          }}
        />
      )}
    </div>
  )
}

function StudentCard({ student }) {
  const pct = student.avgPct
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-navy font-semibold text-sm">
            {student.first_name} {student.last_name || ''}
          </p>
          <p className="text-gray-400 text-xs mt-0.5">
            Grade {student.grade} · {student.primary_subject}
          </p>
        </div>
        <div className="text-right">
          <p className="text-navy font-bold text-sm">{student.weeklySessions} sessions this week</p>
          <p className="text-xs text-gray-400">{student.totalAnswers} questions answered</p>
        </div>
      </div>
      {pct !== null && (
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Practice avg</span>
            <span className={`font-semibold ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-gold' : 'text-red-500'}`}>
              {pct}%
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-gold' : 'bg-red-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({ onCreateClass }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <Users size={48} className="text-gray-300 mb-4" />
      <h2 className="text-navy font-bold text-xl mb-2">Create your first class</h2>
      <p className="text-gray-500 text-sm mb-6 max-w-xs">
        Set up a class to track your students' Archie usage, practice scores and session activity.
      </p>
      <button
        onClick={onCreateClass}
        className="px-8 py-3 bg-navy text-white font-bold rounded-xl active:opacity-90 transition-opacity"
      >
        Create a class
      </button>
    </div>
  )
}

function CreateClassModal({ teacherId, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('teacher_classes')
      .insert({
        teacher_id: teacherId,
        class_name: name.trim(),
        subject: subject || null,
        grade: grade ? parseInt(grade) : null,
      })
      .select()
      .single()

    if (err) {
      setError('Could not create class. Please try again.')
    } else {
      onCreated(data)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white w-full max-w-lg rounded-t-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-navy font-bold text-lg">Create a class</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">Class name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none"
            placeholder="e.g. Grade 11 Maths A"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full h-12 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:border-navy focus:outline-none"
            >
              <option value="">Any subject</option>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Grade</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full h-12 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:border-navy focus:outline-none"
            >
              <option value="">Any grade</option>
              {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={!name.trim() || loading}
          className="w-full h-12 bg-navy text-white font-semibold rounded-xl disabled:opacity-40 active:opacity-90 transition-opacity"
        >
          {loading ? 'Creating…' : 'Create class'}
        </button>
      </div>
    </div>
  )
}

function AddStudentModal({ classId, onClose, onAdded }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return
    setLoading(true)
    setError('')

    // Look up student profile by email
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('email', trimmed)
      .eq('role', 'student')
      .single()

    if (!profile) {
      setError('No student found with that email. Make sure they have registered and completed their profile.')
      setLoading(false)
      return
    }

    const { error: enrollErr } = await supabase
      .from('class_enrollments')
      .upsert({ class_id: classId, student_id: profile.id })

    if (enrollErr && !enrollErr.message.includes('duplicate')) {
      setError('Could not add student. Please try again.')
    } else {
      onAdded()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white w-full max-w-lg rounded-t-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-navy font-bold text-lg">Add student</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">Student's email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none"
            placeholder="student@email.com"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            The student must have already created an account and completed their profile.
          </p>
        </div>
        <button
          onClick={handleAdd}
          disabled={!email.trim() || loading}
          className="w-full h-12 bg-navy text-white font-semibold rounded-xl disabled:opacity-40 active:opacity-90 transition-opacity"
        >
          {loading ? 'Adding…' : 'Add student'}
        </button>
      </div>
    </div>
  )
}
