import { useState } from 'react'
import { feedback, friendlyError } from '../lib/api'
import { X, Star } from 'lucide-react'

export default function FeedbackModal({ sessionId, onClose }) {
  const [rating, setRating] = useState(0)
  const [whatWorked, setWhatWorked] = useState('')
  const [whatFrustrated, setWhatFrustrated] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (rating === 0) return
    setSubmitting(true)
    setError('')
    try {
      await feedback.send({
        session_id: sessionId ?? null,
        rating,
        what_worked: whatWorked.trim() || null,
        what_frustrated: whatFrustrated.trim() || null,
      })
      setSubmitted(true)
      setTimeout(onClose, 1500)
    } catch (err) {
      console.error('Feedback save failed:', err.message)
      setError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white w-full max-w-lg rounded-t-2xl p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-navy font-bold text-lg">Quick Feedback</h3>
          <button onClick={onClose} className="text-gray-400" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          <div className="text-center py-6">
            <p className="text-navy font-semibold text-lg">Thanks! 🙏</p>
            <p className="text-gray-500 text-sm mt-1">Your feedback helps us improve Archie.</p>
          </div>
        ) : (
          <>
            <p className="text-gray-600 text-sm mb-4">How's your session going?</p>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4" role="alert">{error}</div>
            )}

            {/* Star rating */}
            <div className="flex gap-2 mb-5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} className="p-1" aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={n <= rating}>
                  <Star
                    size={28}
                    className={n <= rating ? 'text-gold fill-gold' : 'text-gray-300'}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={whatWorked}
              onChange={(e) => setWhatWorked(e.target.value)}
              placeholder="What worked well?"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3 focus:border-navy focus:outline-none resize-none"
            />

            <textarea
              value={whatFrustrated}
              onChange={(e) => setWhatFrustrated(e.target.value)}
              placeholder="Anything frustrating?"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-4 focus:border-navy focus:outline-none resize-none"
            />

            <button
              onClick={handleSubmit}
              disabled={rating === 0 || submitting}
              className="w-full h-12 bg-navy text-white font-semibold rounded-full disabled:opacity-40 active:opacity-90 transition-opacity"
            >
              {submitting ? 'Sending...' : 'Submit Feedback'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
