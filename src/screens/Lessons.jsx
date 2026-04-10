import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { SUBJECTS, GRADES } from '../data/subjects'
import { getTopics } from '../data/caps/index'
import { ChevronLeft, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'

export default function Lessons() {
  const { profile } = useAuth()
  const [subject, setSubject] = useState(profile?.primary_subject || SUBJECTS[0])
  const [grade, setGrade] = useState(String(profile?.grade || 10))
  const [openTopic, setOpenTopic] = useState(null)

  const topics = getTopics(subject, parseInt(grade))

  async function logView(topicName) {
    if (!profile) return
    // Log to DB for progress tracking (fire-and-forget)
    supabase.from('lesson_views').insert({
      user_id: profile.id,
      lesson_id: null, // static content — no DB lesson_id needed here
      viewed_at: new Date().toISOString(),
    }).then(() => {})
  }

  function toggleTopic(index, topicName) {
    if (openTopic === index) {
      setOpenTopic(null)
    } else {
      setOpenTopic(index)
      logView(topicName)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-navy px-4 py-4">
        <h1 className="text-white text-xl font-bold">Lessons</h1>
        <p className="text-gold text-sm mt-0.5">CAPS-aligned content</p>
      </header>

      {/* Filters */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex gap-3">
        <select
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setOpenTopic(null) }}
          className="flex-1 h-10 px-3 border-2 border-gray-200 rounded-lg text-sm focus:border-navy focus:outline-none bg-white"
        >
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={grade}
          onChange={(e) => { setGrade(e.target.value); setOpenTopic(null) }}
          className="w-28 h-10 px-3 border-2 border-gray-200 rounded-lg text-sm focus:border-navy focus:outline-none bg-white"
        >
          {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
        </select>
      </div>

      {/* Topic list */}
      <div className="px-4 py-4 space-y-3">
        {topics.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No lessons yet for this selection.</p>
          </div>
        ) : (
          topics.map((topic, i) => (
            <TopicCard
              key={i}
              index={i}
              topic={topic}
              isOpen={openTopic === i}
              onToggle={() => toggleTopic(i, topic.topic)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function TopicCard({ index, topic, isOpen, onToggle }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
            <span className="text-navy text-xs font-bold">{index + 1}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-navy font-semibold text-sm">{topic.topic}</p>
            <p className="text-gray-400 text-xs mt-0.5 truncate">{topic.capsRef}</p>
          </div>
        </div>
        {isOpen ? <ChevronUp size={18} className="text-gray-400 shrink-0" /> : <ChevronDown size={18} className="text-gray-400 shrink-0" />}
      </button>

      {isOpen && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {/* Summary */}
          <p className="text-gray-700 text-sm leading-relaxed mt-4 mb-4">{topic.summary}</p>

          {/* Key Concepts */}
          <h3 className="text-navy text-sm font-bold mb-2">Key Concepts</h3>
          <ul className="space-y-1.5 mb-5">
            {topic.keyConcepts.map((concept, j) => (
              <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-gold mt-2 shrink-0" />
                {concept}
              </li>
            ))}
          </ul>

          {/* Worked Example */}
          {topic.workedExample && (
            <div className="bg-navy rounded-xl p-4">
              <p className="text-gold text-xs font-bold uppercase tracking-wide mb-2">Worked Example</p>
              <p className="text-white text-sm font-medium mb-3">{topic.workedExample.question}</p>
              <div className="space-y-1.5">
                {topic.workedExample.steps.map((step, k) => (
                  <p key={k} className="text-white/80 text-sm">{step}</p>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-white/20">
                <p className="text-gold text-sm font-semibold">
                  Answer: {topic.workedExample.answer}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
