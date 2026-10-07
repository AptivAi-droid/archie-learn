/**
 * ClassesCard — the learner's classes on the Progress screen.
 * Students join a teacher's class only by entering the class code (their consent),
 * and can leave any class. GET /me/classes, POST /classes/join, DELETE /me/classes/{id}.
 */
import { useState, useEffect, useRef } from 'react'
import { Users, Plus, X, Loader2, CheckCircle } from 'lucide-react'
import { me, classes as classesApi, friendlyError } from '../lib/api'

export default function ClassesCard() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const [confirmLeaveId, setConfirmLeaveId] = useState(null)
  const [leavingId, setLeavingId] = useState(null)
  const [leaveError, setLeaveError] = useState('')

  useEffect(() => {
    loadClasses()
  }, [])

  async function loadClasses() {
    setLoading(true)
    setLoadError('')
    try {
      const data = await me.classes()
      setClasses(Array.isArray(data) ? data : [])
    } catch (err) {
      setLoadError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  async function leaveClass(classId) {
    setLeavingId(classId)
    setLeaveError('')
    try {
      await me.leaveClass(classId)
      setClasses((prev) => prev.filter((c) => c.id !== classId))
      setConfirmLeaveId(null)
    } catch (err) {
      setLeaveError(friendlyError(err))
    } finally {
      setLeavingId(null)
    }
  }

  function handleJoined(joined) {
    setClasses((prev) => (prev.some((c) => c.id === joined.id) ? prev : [joined, ...prev]))
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-gold" />
          <h3 className="text-navy font-bold text-sm">Your classes</h3>
        </div>
        <button
          onClick={() => setShowJoin(true)}
          className="flex items-center gap-1 text-sm text-navy bg-gold/20 px-3 py-1.5 rounded-full font-medium active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold transition-transform"
        >
          <Plus size={14} /> Join a class
        </button>
      </div>

      {loading ? (
        <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
      ) : loadError ? (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center justify-between gap-3" role="alert">
          <span>{loadError}</span>
          <button onClick={loadClasses} className="shrink-0 font-semibold underline">Retry</button>
        </div>
      ) : classes.length === 0 ? (
        <p className="text-sm text-gray-500">
          Got a class code from your teacher? Tap <span className="font-semibold text-navy">Join a class</span> to
          share your Archie progress with them.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {classes.map((c) => (
            <li key={c.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-navy font-semibold text-sm truncate">{c.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {[c.teacher_first_name && `With ${c.teacher_first_name}`, c.subject, c.grade && `Grade ${c.grade}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {confirmLeaveId === c.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => leaveClass(c.id)}
                      disabled={leavingId === c.id}
                      className="text-xs font-semibold text-white bg-red-500 px-3 py-1.5 rounded-full disabled:opacity-50"
                    >
                      {leavingId === c.id ? 'Leaving…' : 'Leave'}
                    </button>
                    <button
                      onClick={() => { setConfirmLeaveId(null); setLeaveError('') }}
                      disabled={leavingId === c.id}
                      className="text-xs font-medium text-gray-500 px-2 py-1.5 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setConfirmLeaveId(c.id); setLeaveError('') }}
                    className="text-xs font-medium text-gray-400 hover:text-red-500 px-2 py-1.5 shrink-0"
                    aria-label={`Leave ${c.name}`}
                  >
                    Leave
                  </button>
                )}
              </div>
              {confirmLeaveId === c.id && (
                <p className="text-xs text-gray-500 mt-2">
                  Your teacher will stop seeing your progress. You can rejoin later with the class code.
                </p>
              )}
              {confirmLeaveId === c.id && leaveError && (
                <p className="text-xs text-red-600 mt-2" role="alert">{leaveError}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {showJoin && <JoinClassModal onClose={() => setShowJoin(false)} onJoined={handleJoined} />}
    </div>
  )
}

function JoinClassModal({ onClose, onJoined }) {
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [joined, setJoined] = useState(null)
  const inputRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed || submitting) return
    setSubmitting(true)
    setError('')
    try {
      // 201 = joined, 200 = already in this class — same body either way
      const { class: cls } = await classesApi.join(trimmed)
      setJoined(cls)
      onJoined(cls)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-t-2xl p-6 animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-class-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="join-class-title" className="text-navy font-bold text-lg">Join a class</h3>
          <button onClick={onClose} className="text-gray-400 p-1" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {joined ? (
          <div className="text-center py-4" role="status">
            <CheckCircle size={40} className="mx-auto text-green-500 mb-3" />
            <p className="text-navy font-semibold text-lg">You're in {joined.name}!</p>
            <p className="text-gray-500 text-sm mt-1">
              {joined.teacher_first_name ? `${joined.teacher_first_name} can` : 'Your teacher can'} now see your
              Archie progress.
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full h-12 bg-navy text-white font-semibold rounded-xl active:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-gray-600 text-sm">
              Enter the class code your teacher gave you. Joining lets your teacher see your sessions and
              practice scores.
            </p>
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg" role="alert">{error}</div>
            )}
            <div>
              <label htmlFor="join-class-code" className="block text-sm font-medium text-navy mb-1">Class code</label>
              <input
                id="join-class-code"
                ref={inputRef}
                type="text"
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 8)); setError('') }}
                maxLength={8}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base text-center tracking-widest font-mono uppercase focus:border-navy focus:outline-none"
                placeholder="ABCD1234"
              />
            </div>
            <button
              type="submit"
              disabled={!code.trim() || submitting}
              className="w-full h-12 bg-navy text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 active:opacity-90 transition-opacity"
            >
              {submitting ? <><Loader2 size={18} className="animate-spin" /> Joining…</> : 'Join class'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
