import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { SUBJECTS, GRADES } from '../data/subjects'

const ROLES = [
  { value: 'student', label: 'Student', desc: 'I want to learn and get tutored' },
  { value: 'teacher', label: 'Teacher', desc: 'I teach learners and want to track their progress' },
  { value: 'parent', label: 'Parent / Guardian', desc: 'I want to monitor my child's learning' },
]

export default function ProfileSetup() {
  const { saveProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const roleHint = location.state?.roleHint || 'student'
  const [role, setRole] = useState(roleHint)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [grade, setGrade] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState([])
  const [school, setSchool] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleSubject(subject) {
    setSelectedSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : prev.length < 5
          ? [...prev, subject]
          : prev
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!firstName.trim()) return
    if (role === 'student' && (!grade || selectedSubjects.length === 0)) return
    if (role === 'teacher' && selectedSubjects.length === 0) return

    setError('')
    setLoading(true)

    try {
      const profileData = {
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        role,
        subjects: selectedSubjects,
        school: school.trim() || null,
      }

      if (role === 'student') {
        profileData.grade = parseInt(grade)
        profileData.primary_subject = selectedSubjects[0]
      }

      await saveProfile(profileData)

      if (role === 'student') {
        navigate('/meet-archie', { state: { fromSetup: true } })
      } else if (role === 'teacher') {
        navigate('/teacher')
      } else {
        navigate('/parent')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-navy">Tell us about you</h1>
        <p className="text-gray-500 mt-2">So Archie can personalise your experience</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg" role="alert">
            {error}
          </div>
        )}

        {/* Role selector */}
        <div>
          <label className="block text-sm font-medium text-navy mb-2">I am a…</label>
          <div className="space-y-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                  role === r.value
                    ? 'border-navy bg-navy/5'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <p className={`font-semibold text-sm ${role === r.value ? 'text-navy' : 'text-gray-700'}`}>
                  {r.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{r.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-navy mb-1">First name</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none transition-colors"
              placeholder="First"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Last name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none transition-colors"
              placeholder="Last"
            />
          </div>
        </div>

        {/* School (teacher + student) */}
        {(role === 'teacher' || role === 'student') && (
          <div>
            <label className="block text-sm font-medium text-navy mb-1">School</label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none transition-colors"
              placeholder="e.g. Soweto High School"
            />
          </div>
        )}

        {/* Grade (students only) */}
        {role === 'student' && (
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Grade</label>
            <select
              required
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none transition-colors bg-white"
            >
              <option value="">Select your grade</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
          </div>
        )}

        {/* Subjects (student + teacher) */}
        {(role === 'student' || role === 'teacher') && (
          <div>
            <label className="block text-sm font-medium text-navy mb-2">
              {role === 'student' ? 'Subjects' : 'Subjects you teach'}
              {role === 'student' && (
                <span className="text-gray-400 font-normal ml-1">(select up to 5)</span>
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((s) => {
                const selected = selectedSubjects.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSubject(s)}
                    className={`px-3 py-2 rounded-full text-sm font-medium border-2 transition-colors ${
                      selected
                        ? 'bg-navy text-white border-navy'
                        : 'bg-white text-navy border-gray-200'
                    }`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            {role === 'student' && selectedSubjects.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                Primary subject: <span className="text-navy font-medium">{selectedSubjects[0]}</span>
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={
            loading ||
            !firstName.trim() ||
            (role === 'student' && (!grade || selectedSubjects.length === 0)) ||
            (role === 'teacher' && selectedSubjects.length === 0)
          }
          className="w-full h-14 bg-gold text-navy text-lg font-bold rounded-xl active:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Setting up...' : "Let's go"}
        </button>
      </form>
    </div>
  )
}
