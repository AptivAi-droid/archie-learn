import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { teacher, friendlyError } from '../lib/api'
import { SUBJECTS, GRADES } from '../data/subjects'
import { Plus, Users, Download, LogOut, X, Copy, Check, Trash2 } from 'lucide-react'

export default function TeacherDashboard() {
  const { user, profile, signOut } = useAuth()
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [students, setStudents] = useState([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [classesError, setClassesError] = useState('')
  const [studentsError, setStudentsError] = useState('')
  const [actionError, setActionError] = useState('')
  const [showCreateClass, setShowCreateClass] = useState(false)
  const [confirmDeleteClass, setConfirmDeleteClass] = useState(false)
  const [deletingClass, setDeletingClass] = useState(false)
  // Latest activity request wins when the teacher flips between classes quickly
  const activitySeqRef = useRef(0)

  useEffect(() => {
    fetchClasses()
  }, [user?.id])

  useEffect(() => {
    setConfirmDeleteClass(false)
    setActionError('')
    if (selectedClass?.id != null) fetchStudents(selectedClass.id)
  }, [selectedClass?.id])

  async function fetchClasses() {
    if (!user) return
    setLoadingClasses(true)
    setClassesError('')
    try {
      // GET /teacher/classes → [{ id, name, subject, grade, join_code, student_count, created_at }]
      const data = await teacher.classes()
      const list = Array.isArray(data) ? data : []
      setClasses(list)
      setSelectedClass((prev) => list.find((c) => c.id === prev?.id) || list[0] || null)
    } catch (err) {
      setClassesError(friendlyError(err))
    } finally {
      setLoadingClasses(false)
    }
  }

  async function fetchStudents(classId) {
    const seq = ++activitySeqRef.current
    setLoadingStudents(true)
    setStudentsError('')
    try {
      // GET /teacher/classes/{id}/activity → { students, sessions, answers } (last 30 days)
      const data = await teacher.classActivity(classId)
      if (seq !== activitySeqRef.current) return
      setStudents(summariseActivity(data))
    } catch (err) {
      if (seq !== activitySeqRef.current) return
      setStudents([])
      setStudentsError(friendlyError(err))
    } finally {
      if (seq === activitySeqRef.current) setLoadingStudents(false)
    }
  }

  async function removeStudent(student) {
    setActionError('')
    try {
      await teacher.removeStudent(selectedClass.id, student.id)
      setStudents((prev) => prev.filter((s) => s.id !== student.id))
      updateStudentCount(selectedClass.id, -1)
    } catch (err) {
      setActionError(friendlyError(err))
      throw err
    }
  }

  async function deleteClass() {
    if (!selectedClass) return
    setDeletingClass(true)
    setActionError('')
    try {
      await teacher.deleteClass(selectedClass.id)
      const remaining = classes.filter((c) => c.id !== selectedClass.id)
      setClasses(remaining)
      setSelectedClass(remaining[0] || null)
      setStudents([])
    } catch (err) {
      setActionError(friendlyError(err))
    } finally {
      setDeletingClass(false)
      setConfirmDeleteClass(false)
    }
  }

  function updateStudentCount(classId, delta) {
    setClasses((prev) => prev.map((c) =>
      c.id === classId ? { ...c, student_count: Math.max(0, (Number(c.student_count) || 0) + delta) } : c
    ))
  }

  function exportStudentCSV() {
    if (!students.length) return
    const rows = students.map((s) => ({
      name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
      grade: s.grade,
      subject: s.primary_subject,
      weekly_sessions: s.weeklySessions,
      practice_avg: s.avgPct !== null ? `${s.avgPct}%` : 'N/A',
    }))
    const headers = Object.keys(rows[0])
    const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedClass?.name || 'class'}-students.csv`
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
                aria-pressed={selectedClass?.id === c.id}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
                  selectedClass?.id === c.id
                    ? 'bg-navy text-white border-navy'
                    : 'bg-white text-navy border-gray-200'
                }`}
              >
                {c.name}
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

      {classesError ? (
        <div className="p-4 max-w-2xl mx-auto">
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center justify-between gap-3" role="alert">
            <span>{classesError}</span>
            <button onClick={fetchClasses} className="shrink-0 font-semibold underline">Retry</button>
          </div>
        </div>
      ) : classes.length === 0 && !loadingClasses ? (
        <EmptyState onCreateClass={() => setShowCreateClass(true)} />
      ) : selectedClass && (
        <div className="p-4 max-w-2xl mx-auto space-y-4">
          {/* Class header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-navy font-bold text-lg">{selectedClass.name}</h2>
              <p className="text-gray-400 text-sm">
                {selectedClass.subject && `${selectedClass.subject} · `}
                {selectedClass.grade && `Grade ${selectedClass.grade} · `}
                {students.length} student{students.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              {students.length > 0 && (
                <button
                  onClick={exportStudentCSV}
                  className="flex items-center gap-1 text-sm text-navy bg-gray-100 px-3 py-1.5 rounded-full font-medium"
                >
                  <Download size={14} /> CSV
                </button>
              )}
              <button
                onClick={() => setConfirmDeleteClass(true)}
                className="flex items-center gap-1 text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-full font-medium"
                aria-label={`Delete class ${selectedClass.name}`}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>

          {confirmDeleteClass && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-sm text-red-700">
                Delete <span className="font-semibold">{selectedClass.name}</span>? Students stay on Archie, but you'll
                stop seeing their progress and the class code will stop working.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={deleteClass}
                  disabled={deletingClass}
                  className="flex-1 h-10 bg-red-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                >
                  {deletingClass ? 'Deleting…' : 'Delete class'}
                </button>
                <button
                  onClick={() => setConfirmDeleteClass(false)}
                  disabled={deletingClass}
                  className="flex-1 h-10 bg-white border-2 border-gray-200 text-navy text-sm font-semibold rounded-xl disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {actionError && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg" role="alert">{actionError}</div>
          )}

          {/* How students join — they enter the class code themselves (their consent) */}
          <JoinCodePanel joinCode={selectedClass.join_code} />

          {loadingStudents ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : studentsError ? (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center justify-between gap-3" role="alert">
              <span>{studentsError}</span>
              <button onClick={() => fetchStudents(selectedClass.id)} className="shrink-0 font-semibold underline">Retry</button>
            </div>
          ) : students.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
              <Users size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">
                No students yet. Share the class code above — students appear here once they join.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {students.map((s) => (
                <StudentCard key={s.id} student={s} onRemove={removeStudent} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create class modal */}
      {showCreateClass && (
        <CreateClassModal
          onClose={() => setShowCreateClass(false)}
          onCreated={(newClass) => {
            const withCount = { student_count: 0, ...newClass }
            setClasses((prev) => [withCount, ...prev])
            setSelectedClass(withCount)
            setShowCreateClass(false)
          }}
        />
      )}
    </div>
  )
}

// Per-student weekly sessions + practice average from the class activity payload
function summariseActivity(data) {
  const roster = Array.isArray(data?.students) ? data.students : []
  const sessions = Array.isArray(data?.sessions) ? data.sessions : []
  const answers = Array.isArray(data?.answers) ? data.answers : []
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  return roster.map((p) => {
    const sSessions = sessions.filter((s) => String(s.user_id) === String(p.id) && new Date(s.created_at) >= weekAgo)
    const sAnswers = answers.filter((a) => String(a.user_id) === String(p.id))
    const totalScore = sAnswers.reduce((s, a) => s + (Number(a.ai_score) || 0), 0)
    const totalMax = sAnswers.reduce((s, a) => s + (Number(a.max_marks) || 0), 0)
    return {
      ...p,
      weeklySessions: sSessions.length,
      totalAnswers: sAnswers.length,
      avgPct: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null,
    }
  })
}

function JoinCodePanel({ joinCode }) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  async function copyCode() {
    if (!joinCode) return
    setCopyFailed(false)
    try {
      await navigator.clipboard.writeText(joinCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyFailed(true)
    }
  }

  return (
    <div className="bg-navy rounded-2xl p-5">
      <p className="text-gold text-xs font-bold uppercase tracking-wide">Class code</p>
      <div className="flex items-center justify-between gap-3 mt-2">
        <p className="text-white font-mono text-3xl font-bold tracking-widest select-all break-all">
          {joinCode || '—'}
        </p>
        <button
          onClick={copyCode}
          disabled={!joinCode}
          className="shrink-0 h-12 px-4 flex items-center gap-2 bg-gold text-navy font-semibold rounded-xl active:opacity-90 transition-opacity disabled:opacity-50"
          aria-label="Copy class code"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p className="text-white/70 text-sm mt-3 leading-relaxed">
        Students join by entering this code in Archie (Progress → Join a class)
      </p>
      {copyFailed && (
        <p className="text-gold text-xs mt-2" role="status">Couldn't copy automatically — select the code and copy it.</p>
      )}
    </div>
  )
}

function StudentCard({ student, onRemove }) {
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const pct = student.avgPct
  const fullName = `${student.first_name || 'Student'} ${student.last_name || ''}`.trim()

  async function handleRemove() {
    setRemoving(true)
    try {
      await onRemove(student)
    } catch {
      // Parent shows the error; stay on this card
      setRemoving(false)
      setConfirming(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-navy font-semibold text-sm">{fullName}</p>
          <p className="text-gray-400 text-xs mt-0.5">
            {[student.grade && `Grade ${student.grade}`, student.primary_subject].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-navy font-bold text-sm">{student.weeklySessions} sessions this week</p>
          <p className="text-xs text-gray-400">{student.totalAnswers} questions (30 days)</p>
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
      <div className="mt-3 flex justify-end">
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Remove from class?</span>
            <button
              onClick={handleRemove}
              disabled={removing}
              className="text-xs font-semibold text-white bg-red-500 px-3 py-1.5 rounded-full disabled:opacity-50"
            >
              {removing ? 'Removing…' : 'Remove'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={removing}
              className="text-xs font-medium text-gray-500 px-2 py-1.5 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs font-medium text-gray-400 hover:text-red-500 px-2 py-1"
            aria-label={`Remove ${fullName} from class`}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

function EmptyState({ onCreateClass }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <Users size={48} className="text-gray-300 mb-4" />
      <h2 className="text-navy font-bold text-xl mb-2">Create your first class</h2>
      <p className="text-gray-500 text-sm mb-6 max-w-xs">
        Set up a class, then share its code. Students who join will show their Archie usage, practice scores and
        session activity here.
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

function CreateClassModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      // POST /teacher/classes → 201 { class } with a generated 8-char join_code
      const { class: created } = await teacher.createClass({
        name: name.trim(),
        subject: subject || null,
        grade: grade ? parseInt(grade) : null,
      })
      onCreated(created)
    } catch (err) {
      setError(friendlyError(err))
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div
        className="bg-white w-full max-w-lg rounded-t-2xl p-6 space-y-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-class-title"
      >
        <div className="flex items-center justify-between">
          <h3 id="create-class-title" className="text-navy font-bold text-lg">Create a class</h3>
          <button onClick={onClose} aria-label="Close"><X size={20} className="text-gray-400" /></button>
        </div>
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg" role="alert">{error}</div>}
        <div>
          <label htmlFor="class-name" className="block text-sm font-medium text-navy mb-1">Class name</label>
          <input
            id="class-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none"
            placeholder="e.g. Grade 11 Maths A"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="class-subject" className="block text-sm font-medium text-navy mb-1">Subject</label>
            <select
              id="class-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full h-12 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:border-navy focus:outline-none"
            >
              <option value="">Any subject</option>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="class-grade" className="block text-sm font-medium text-navy mb-1">Grade</label>
            <select
              id="class-grade"
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
