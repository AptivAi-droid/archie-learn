import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const GRADES = ['8', '9', '10', '11', '12']
const SUBJECTS = [
  'Mathematics',
  'Physical Sciences',
  'English Home Language',
  'Life Sciences',
  'Accounting',
]

export default function ProfileSetup() {
  const [firstName, setFirstName] = useState('')
  const [grade, setGrade] = useState('')
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { saveProfile } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await saveProfile({
        first_name: firstName,
        grade: parseInt(grade),
        primary_subject: subject,
        role: 'student',
      })
      navigate('/meet-archie', { state: { fromSetup: true } })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-navy">Tell us about you</h1>
        <p className="text-gray-500 mt-2">So Archie can personalise your learning</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-navy mb-1">First name</label>
          <input
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none transition-colors"
            placeholder="Your first name"
          />
        </div>

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

        <div>
          <label className="block text-sm font-medium text-navy mb-1">Primary subject</label>
          <select
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none transition-colors bg-white"
          >
            <option value="">Select a subject</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !firstName || !grade || !subject}
          className="w-full h-14 bg-gold text-navy text-lg font-bold rounded-xl active:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Setting up...' : "Let's go"}
        </button>
      </form>
    </div>
  )
}
