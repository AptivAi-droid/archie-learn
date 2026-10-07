import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { practice, friendlyError } from '../lib/api'
import { SUBJECTS, GRADES } from '../data/subjects'
import { CheckCircle, XCircle, Send, RefreshCw } from 'lucide-react'
import { sanitizeInput } from '../lib/sanitize'

// The server picks a random set per request and never sends model answers
const QUESTIONS_PER_SESSION = 5

export default function Practice() {
  const { profile } = useAuth()
  const [subject, setSubject] = useState(profile?.primary_subject || SUBJECTS[0])
  const [grade, setGrade] = useState(String(profile?.grade || 10))
  const [questions, setQuestions] = useState([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [marking, setMarking] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [markError, setMarkError] = useState('')
  const [sessionResults, setSessionResults] = useState([])
  const [done, setDone] = useState(false)
  // Latest question request wins when the learner flips filters quickly
  const loadSeqRef = useRef(0)

  useEffect(() => {
    fetchQuestions()
  }, [subject, grade])

  async function fetchQuestions() {
    setLoadingQuestions(true)
    setQuestions([])
    setCurrentIndex(0)
    setAnswer('')
    setResult(null)
    setSessionResults([])
    setDone(false)
    setLoadError('')
    setMarkError('')

    const seq = ++loadSeqRef.current
    try {
      const data = await practice.questions({
        subject,
        grade: parseInt(grade),
        limit: QUESTIONS_PER_SESSION,
      })
      if (seq !== loadSeqRef.current) return
      if (!Array.isArray(data) || data.length === 0) {
        setLoadError('No practice questions available for this selection yet.')
      } else {
        setQuestions(data.slice(0, QUESTIONS_PER_SESSION))
      }
    } catch (err) {
      if (seq !== loadSeqRef.current) return
      console.warn('Could not load practice questions:', err.message)
      setLoadError(
        err.code === 'NETWORK' || err.code === 'TIMEOUT'
          ? friendlyError(err)
          : 'Could not load questions. Please try again.'
      )
    } finally {
      if (seq === loadSeqRef.current) setLoadingQuestions(false)
    }
  }

  async function submitAnswer() {
    if (!answer.trim() || marking) return
    setMarking(true)
    setMarkError('')

    const question = questions[currentIndex]
    const safeAnswer = sanitizeInput(answer, 3000)

    try {
      // The server marks against the model answer and stores the user_answers row itself
      const marked = await practice.answer({ question_id: question.id, answer: safeAnswer })
      const data = {
        score: Number(marked?.score) || 0,
        maxMarks: Number(marked?.max_marks) || question.marks || 0,
        feedback: marked?.feedback || '',
        encouragement: marked?.encouragement || '',
      }

      setResult(data)

      setSessionResults((prev) => [...prev, {
        questionText: question.question_text,
        score: data.score,
        maxMarks: data.maxMarks,
      }])
    } catch (err) {
      // Keep the question and typed answer on screen; show the error under Submit
      // (429 / 502 carry the server's learner-friendly text)
      setMarkError(friendlyError(err))
    } finally {
      setMarking(false)
    }
  }

  function nextQuestion() {
    if (currentIndex + 1 >= questions.length) {
      setDone(true)
    } else {
      setCurrentIndex((i) => i + 1)
      setAnswer('')
      setResult(null)
      setMarkError('')
    }
  }

  function restart() {
    fetchQuestions()
  }

  const totalScore = sessionResults.reduce((sum, r) => sum + r.score, 0)
  const totalMax = sessionResults.reduce((sum, r) => sum + r.maxMarks, 0)

  if (done) {
    const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <header className="bg-navy px-4 py-4">
          <h1 className="text-white text-xl font-bold">Practice Complete!</h1>
        </header>
        <div className="px-4 py-6 space-y-4">
          {/* Score summary */}
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className={`text-5xl font-bold mb-2 ${pct >= 70 ? 'text-gold' : pct >= 50 ? 'text-navy' : 'text-red-500'}`}>
              {pct}%
            </div>
            <p className="text-gray-600 text-base">
              You scored <span className="font-bold text-navy">{totalScore}/{totalMax}</span> marks
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {pct >= 80 ? 'Outstanding work — sharp sharp!' : pct >= 60 ? 'Good effort! A bit more practice and you\'ll nail it.' : 'Keep going — every attempt builds understanding.'}
            </p>
          </div>

          {/* Per-question breakdown */}
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-navy font-bold text-sm mb-2">Question breakdown</h3>
            {sessionResults.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <p className="text-sm text-gray-600 flex-1 mr-4 truncate">Q{i + 1}: {r.questionText.slice(0, 50)}…</p>
                <span className={`text-sm font-bold shrink-0 ${r.score === r.maxMarks ? 'text-green-600' : r.score > 0 ? 'text-gold' : 'text-red-500'}`}>
                  {r.score}/{r.maxMarks}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={restart}
            className="w-full h-14 bg-navy text-white text-lg font-semibold rounded-xl flex items-center justify-center gap-2 active:opacity-90 transition-opacity"
          >
            <RefreshCw size={18} /> Practice again
          </button>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-navy px-4 py-4">
        <h1 className="text-white text-xl font-bold">Practice</h1>
        <p className="text-gold text-sm mt-0.5">Test yourself with AI marking</p>
      </header>

      {/* Filters */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex gap-3">
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="flex-1 h-10 px-3 border-2 border-gray-200 rounded-lg text-sm focus:border-navy focus:outline-none bg-white"
          disabled={loadingQuestions || marking}
        >
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="w-28 h-10 px-3 border-2 border-gray-200 rounded-lg text-sm focus:border-navy focus:outline-none bg-white"
          disabled={loadingQuestions || marking}
        >
          {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
        </select>
      </div>

      <div className="px-4 py-4">
        {loadingQuestions && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Loading questions…</p>
          </div>
        )}

        {loadError && !loadingQuestions && (
          <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl text-center" role="alert">
            {loadError}
          </div>
        )}

        {!loadingQuestions && !loadError && currentQuestion && (
          <div className="space-y-4">
            {/* Progress */}
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Question {currentIndex + 1} of {questions.length}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                currentQuestion.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                currentQuestion.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                'bg-gold/20 text-navy'
              }`}>
                {currentQuestion.difficulty} · {currentQuestion.marks} mark{currentQuestion.marks !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="w-full h-1.5 bg-gray-200 rounded-full">
              <div
                className="h-full bg-gold rounded-full transition-all"
                style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
              />
            </div>

            {/* Question card */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-navy font-semibold text-base leading-relaxed">
                {currentQuestion.question_text}
              </p>
            </div>

            {/* Answer input */}
            {!result && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <label className="block text-sm font-medium text-navy mb-2">Your answer</label>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Write your answer here…"
                  rows={5}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-navy focus:outline-none resize-none transition-colors"
                  disabled={marking}
                />
                <button
                  onClick={submitAnswer}
                  disabled={!answer.trim() || marking}
                  className="mt-3 w-full h-12 bg-navy text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 active:opacity-90 transition-opacity"
                >
                  {marking ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Archie is marking…
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Submit answer
                    </>
                  )}
                </button>
                {markError && (
                  <p className="mt-3 bg-red-50 text-red-600 text-sm p-3 rounded-xl text-center" role="alert">
                    {markError}
                  </p>
                )}
              </div>
            )}

            {/* Result card */}
            {result && (
              <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
                {/* Score */}
                <div className="flex items-center gap-3">
                  {result.score === result.maxMarks ? (
                    <CheckCircle size={24} className="text-green-500 shrink-0" />
                  ) : result.score > 0 ? (
                    <CheckCircle size={24} className="text-gold shrink-0" />
                  ) : (
                    <XCircle size={24} className="text-red-500 shrink-0" />
                  )}
                  <div>
                    <p className="text-navy font-bold text-lg">
                      {result.score} / {result.maxMarks} marks
                    </p>
                    <p className="text-gray-500 text-sm">
                      {result.maxMarks > 0 ? Math.round((result.score / result.maxMarks) * 100) : 0}%
                    </p>
                  </div>
                </div>

                {/* Your answer */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Your answer</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{answer}</p>
                </div>

                {/* Feedback */}
                <div className="bg-navy/5 rounded-xl p-4">
                  <p className="text-xs font-bold text-navy uppercase tracking-wide mb-2">Archie's Feedback</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{result.feedback}</p>
                  <p className="text-sm text-gold font-medium mt-2">{result.encouragement}</p>
                </div>

                <button
                  onClick={nextQuestion}
                  className="w-full h-12 bg-gold text-navy font-bold rounded-xl active:opacity-90 transition-opacity"
                >
                  {currentIndex + 1 >= questions.length ? 'See results' : 'Next question →'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
