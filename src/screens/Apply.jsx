import { useState, useMemo } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { SUBJECTS, GRADES } from '../data/subjects'

const VET_URL = 'https://glfivzdteschyfvyllqw.supabase.co/functions/v1/vet-application'

function computeAge(dobIso) {
  if (!dobIso) return null
  const dob = new Date(dobIso)
  if (Number.isNaN(dob.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

export default function Apply() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signIn } = useAuth()

  // Carry-over from Signup if user landed here from there
  const prefill = location.state || {}

  const [step, setStep] = useState('form') // 'form' | 'submitting' | 'outcome'
  const [outcome, setOutcome] = useState(null) // { outcome, message, red_flags? }

  // Account fields
  const [email, setEmail] = useState(prefill.email || '')
  const [password, setPassword] = useState(prefill.password || '')
  const [dob, setDob] = useState(prefill.dob || '')

  // Role + role-specific
  const [role, setRole] = useState('teacher')

  // Teacher fields
  const [school, setSchool] = useState('')
  const [subjects, setSubjects] = useState([])
  const [gradesTaught, setGradesTaught] = useState([])
  const [yearsExperience, setYearsExperience] = useState('')

  // Parent fields
  const [childName, setChildName] = useState('')
  const [childGrade, setChildGrade] = useState('')
  const [childSchool, setChildSchool] = useState('')
  const [childLinkCode, setChildLinkCode] = useState('')

  const [whyJoin, setWhyJoin] = useState('')
  const [error, setError] = useState('')

  const age = useMemo(() => computeAge(dob), [dob])

  function toggleSubject(s) {
    setSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }
  function toggleGrade(g) {
    setGradesTaught((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
  }

  function validate() {
    if (!email.trim() || !password || password.length < 8) {
      setError('Please provide a valid email and a password (at least 8 characters).')
      return false
    }
    if (!dob) {
      setError('Please enter your date of birth.')
      return false
    }
    if (age === null || age < 18) {
      setError('Adult accounts are for ages 18 and older.')
      return false
    }
    if (role === 'teacher') {
      if (!school.trim() || subjects.length === 0 || !yearsExperience) {
        setError('Please fill in your school, subjects you teach, and years of experience.')
        return false
      }
    } else {
      if (!childName.trim() || !childGrade) {
        setError("Please fill in your child's first name and grade.")
        return false
      }
    }
    if (!whyJoin.trim() || whyJoin.trim().length < 20) {
      setError('Please write a short reason for joining (at least 20 characters).')
      return false
    }
    setError('')
    return true
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    setStep('submitting')
    try {
      const application_data =
        role === 'teacher'
          ? {
              school: school.trim(),
              subjects,
              grades_taught: gradesTaught,
              years_experience: Number(yearsExperience),
              why_join: whyJoin.trim(),
            }
          : {
              child_name: childName.trim(),
              child_grade: Number(childGrade),
              child_school: childSchool.trim() || null,
              child_link_code: childLinkCode.trim() || null,
              why_join: whyJoin.trim(),
            }

      const resp = await fetch(VET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          role,
          dob,
          application_data,
        }),
      })
      const data = await resp.json()

      if (!resp.ok && !data.outcome) {
        setError(data.error || 'Application could not be submitted. Please try again.')
        setStep('form')
        return
      }

      // Approved: try immediate sign-in
      if (data.outcome === 'APPROVED') {
        try {
          await signIn(email.trim(), password)
          // After signin, ProfileSetup will collect first_name/last_name
          navigate('/setup', { state: { roleHint: role, dob } })
          return
        } catch {
          // Fall through to outcome screen with login prompt
        }
      }

      setOutcome(data)
      setStep('outcome')
    } catch (err) {
      setError(err.message || 'Network error. Please try again.')
      setStep('form')
    }
  }

  if (step === 'submitting') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10">
        <div className="text-center">
          <div className="w-14 h-14 bg-navy rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-gold text-xl font-bold">A</span>
          </div>
          <h2 className="text-xl font-bold text-navy">Reviewing your application…</h2>
          <p className="text-gray-500 mt-2 text-sm max-w-xs">
            Our AI agent is checking your details. This takes about 5 seconds.
          </p>
        </div>
      </div>
    )
  }

  if (step === 'outcome') {
    const isApproved = outcome?.outcome === 'APPROVED'
    const isReview = outcome?.outcome === 'NEEDS_REVIEW'
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
              isApproved ? 'bg-green-500' : isReview ? 'bg-gold' : 'bg-red-500'
            }`}
          >
            <span className="text-white text-2xl font-bold">{isApproved ? '✓' : isReview ? '…' : '×'}</span>
          </div>
          <h1 className="text-2xl font-bold text-navy">
            {isApproved ? 'Account created' : isReview ? "We're reviewing your application" : "We couldn't verify your application"}
          </h1>
          <p className="text-gray-600 mt-3 leading-relaxed">{outcome?.message}</p>
          {outcome?.red_flags && outcome.red_flags.length > 0 && (
            <p className="text-xs text-gray-400 mt-3">
              Flagged: {outcome.red_flags.join(', ')}
            </p>
          )}
          {isApproved ? (
            <button
              onClick={() => navigate('/login')}
              className="mt-8 w-full h-14 bg-navy text-white text-lg font-semibold rounded-xl"
            >
              Go to login
            </button>
          ) : isReview ? (
            <button
              onClick={() => navigate('/')}
              className="mt-8 w-full h-14 bg-navy text-white text-lg font-semibold rounded-xl"
            >
              Back to home
            </button>
          ) : (
            <button
              onClick={() => setStep('form')}
              className="mt-8 w-full h-14 bg-navy text-white text-lg font-semibold rounded-xl"
            >
              Refine and resubmit
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 py-10">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-navy rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-gold text-xl font-bold">A</span>
        </div>
        <h1 className="text-3xl font-bold text-navy">Teacher / Parent application</h1>
        <p className="text-gray-500 mt-2 max-w-md">
          Our AI agent will review your application instantly. Most are approved on the spot.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg" role="alert">{error}</div>
        )}

        {/* Account */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none"
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none"
                placeholder="At least 8 chars"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Date of birth</label>
              <input
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full h-12 px-3 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-navy mb-2">I am a…</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'teacher', label: 'Teacher' },
              { value: 'parent', label: 'Parent / Guardian' },
            ].map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={`px-4 py-3 rounded-xl border-2 font-semibold transition-colors ${
                  role === r.value ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-white text-navy'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Teacher-specific */}
        {role === 'teacher' && (
          <>
            <div>
              <label className="block text-sm font-medium text-navy mb-1">School name</label>
              <input
                type="text"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none"
                placeholder="e.g. Pretoria Boys High School"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-2">Subjects you teach</label>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSubject(s)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 ${
                      subjects.includes(s) ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-white text-navy'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-2">Grades you teach</label>
              <div className="flex flex-wrap gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGrade(g)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 ${
                      gradesTaught.includes(g) ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-white text-navy'
                    }`}
                  >
                    Gr {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Years of teaching experience</label>
              <input
                type="number"
                min="0"
                max="60"
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
                className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none"
                placeholder="e.g. 8"
              />
            </div>
          </>
        )}

        {/* Parent-specific */}
        {role === 'parent' && (
          <>
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Child's first name</label>
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none"
                placeholder="e.g. Lerato"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-navy mb-1">Child's grade</label>
                <select
                  value={childGrade}
                  onChange={(e) => setChildGrade(e.target.value)}
                  className="w-full h-12 px-3 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none bg-white"
                >
                  <option value="">Select grade</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>Grade {g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy mb-1">Child's school</label>
                <input
                  type="text"
                  value={childSchool}
                  onChange={(e) => setChildSchool(e.target.value)}
                  className="w-full h-12 px-3 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none"
                  placeholder="optional"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Child's 6-char link code <span className="text-gray-400 font-normal">(optional, but speeds up approval)</span>
              </label>
              <input
                type="text"
                value={childLinkCode}
                onChange={(e) => setChildLinkCode(e.target.value.toUpperCase().slice(0, 6))}
                maxLength={6}
                className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base text-center tracking-widest font-mono focus:border-navy focus:outline-none"
                placeholder="ABC123"
              />
            </div>
          </>
        )}

        {/* Why join — required */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">
            Why do you want to join Archie Learn?{' '}
            <span className="text-gray-400 font-normal">(min 20 chars)</span>
          </label>
          <textarea
            value={whyJoin}
            onChange={(e) => setWhyJoin(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none resize-none"
            placeholder="Tell us briefly what brought you here…"
          />
          <p className="text-xs text-gray-400 mt-1">{whyJoin.length}/500</p>
        </div>

        <button
          type="submit"
          className="w-full h-14 bg-navy text-white text-lg font-semibold rounded-xl active:opacity-90 transition-opacity"
        >
          Submit application
        </button>

        <p className="text-xs text-gray-400 text-center pt-2">
          Already have an account?{' '}
          <Link to="/login" className="text-gold font-medium underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  )
}
