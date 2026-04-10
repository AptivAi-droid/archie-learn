import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { SUBJECTS, GRADES } from '../data/subjects'
import { CheckCircle, XCircle, Send, RefreshCw } from 'lucide-react'
import { sanitizeInput } from '../lib/sanitize'

const MARK_API_URL = import.meta.env.VITE_MARK_API_URL || '/api/mark'

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
  const [error, setError] = useState('')
  const [sessionResults, setSessionResults] = useState([])
  const [done, setDone] = useState(false)

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
    setError('')

    const { data, error: dbError } = await supabase
      .from('practice_questions')
      .select('*')
      .eq('subject', subject)
      .eq('grade', parseInt(grade))
      .limit(5)

    if (dbError) {
      setError('Could not load questions. Please try again.')
    } else if (!data || data.length === 0) {
      setError('No practice questions available for this selection yet.')
    } else {
      // Shuffle
      const shuffled = [...data].sort(() => Math.random() - 0.5)
      setQuestions(shuffled)
    }
    setLoadingQuestions(false)
  }

  async function submitAnswer() {
    if (!answer.trim() || marking) return
    setMarking(true)
    setError('')

    const question = questions[currentIndex]
    const safeAnswer = sanitizeInput(answer, 3000)

    try {
      const response = await fetch(MARK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.question_text,
          modelAnswer: question.model_answer,
          studentAnswer: safeAnswer,
          marks: question.marks,
          subject,
          grade,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Marking failed')
      }

      setResult(data)

      // Save to DB
      if (profile) {
        await supabase.from('user_answers').insert({
          user_id: profile.id,
          question_id: question.id,
          answer_text: safeAnswer,
          ai_score: data.score,
          ai_feedback: data.feedback,
          max_marks: data.maxMarks,
        })
      }

      setSessionResults((prev) => [...prev, {
        questionText: question.question_text,
        score: data.score,
        maxMarks: data.maxMarks,
      }])
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
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

        {error && !loadingQuestions && (
          <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl text-center">
            {error}
          </div>
        )}

        {!loadingQuestions && !error && currentQuestion && (
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
                      {Math.round((result.score / result.maxMarks) * 100)}%
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
