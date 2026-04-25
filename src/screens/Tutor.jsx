import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Send, Mic, ChevronDown, Link2 } from 'lucide-react'
import FeedbackModal from '../components/FeedbackModal'
import LinkCodeModal from '../components/LinkCodeModal'
import { SUBJECTS } from '../data/subjects'
import { sanitizeInput } from '../lib/sanitize'
import { getDemoResponse, isDemoMode, toggleDemoMode } from '../lib/demoResponses'

const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL || '/api/chat'

const SYSTEM_PROMPT = (name, grade, subject) => `You are Archie, a warm and encouraging AI study partner for South African high school learners. You speak in a friendly, conversational tone — like a knowledgeable friend, not a textbook. You use simple, clear language appropriate to the learner's grade level.

The learner's name is ${name}. They are in Grade ${grade}, studying ${subject}.

CRITICAL RULES:
1. Never give the answer directly. Always ask the learner to attempt the problem first. If they haven't attempted it, respond with a Socratic question that guides them toward the first step.
2. When a learner is stuck after 2 attempts, give a hint — not the answer. After 3 attempts, walk through the solution step by step, praising their effort.
3. Always acknowledge what the learner got RIGHT before addressing what's wrong.
4. Keep responses short — 3 to 5 sentences maximum for explanations. Break complexity into multiple short turns.
5. Use South African context for examples where possible (taxi fares, spaza shops, sport statistics, rands and cents, local place names).
6. Celebrate wins explicitly: "Sharp sharp!", "That's it!", "You've got it now."
7. If a learner seems frustrated (uses words like "I don't understand", "this is hard", "I give up"), respond with extra warmth before attempting any explanation.
8. You are trained on the South African CAPS curriculum. All explanations must be CAPS-aligned for the learner's stated grade and subject.
9. Never use bullet points in your responses. Speak in natural conversational sentences only.
10. Start every new session with: "What are we working on today?" — never jump straight into content.`

export default function Tutor() {
  const { user, profile, saveProfile } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [messageCount, setMessageCount] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showSubjectPicker, setShowSubjectPicker] = useState(false)
  const [showLinkCode, setShowLinkCode] = useState(false)
  const [demoMode, setDemoMode] = useState(isDemoMode)
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef(null)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  // Triple-tap logo to toggle demo mode (hidden from testers)
  const handleLogoTap = useCallback(() => {
    tapCountRef.current += 1
    clearTimeout(tapTimerRef.current)
    tapTimerRef.current = setTimeout(() => {
      if (tapCountRef.current >= 3) {
        const newState = toggleDemoMode()
        setDemoMode(newState)
      }
      tapCountRef.current = 0
    }, 400)
  }, [])

  const name = profile?.first_name || 'Learner'
  const grade = profile?.grade || 10
  const subject = profile?.primary_subject || 'Mathematics'

  useEffect(() => {
    startSession()
  }, [subject])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    // Show feedback after every 10 user messages
    if (messageCount > 0 && messageCount % 10 === 0) {
      setShowFeedback(true)
    }
  }, [messageCount])

  async function startSession() {
    const { data } = await supabase
      .from('chat_sessions')
      .insert({ user_id: user.id })
      .select()
      .single()

    if (data) setSessionId(data.id)

    const openingMessage = {
      role: 'assistant',
      content: `Hey ${name}! What are we working on today?`,
    }
    setMessages([openingMessage])
    setMessageCount(0)
    saveMessage(data?.id, openingMessage)
  }

  async function saveMessage(sessId, message) {
    if (!sessId) return
    await supabase.from('chat_messages').insert({
      session_id: sessId,
      user_id: user.id,
      role: message.role,
      content: message.content,
    })
  }

  async function switchSubject(newSubject) {
    if (newSubject === subject) {
      setShowSubjectPicker(false)
      return
    }
    try {
      await saveProfile({ primary_subject: newSubject })
    } catch (err) {
      console.error('Failed to switch subject:', err)
    }
    setShowSubjectPicker(false)
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const safeInput = sanitizeInput(input, 2000)
    const userMessage = { role: 'user', content: safeInput }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)
    setMessageCount((c) => c + 1)
    saveMessage(sessionId, userMessage)

    if (demoMode) {
      // Demo mode: simulate realistic AI response with typing delay
      const delay = 800 + Math.random() * 1500 // 0.8–2.3 seconds
      await new Promise((r) => setTimeout(r, delay))
      const demoContent = getDemoResponse(name, subject, messageCount, safeInput)
      const assistantMessage = { role: 'assistant', content: demoContent }
      setMessages((prev) => [...prev, assistantMessage])
      saveMessage(sessionId, assistantMessage)
      setLoading(false)
      inputRef.current?.focus()
      return
    }

    try {
      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          system: SYSTEM_PROMPT(name, grade, subject),
          userId: user?.id,
        }),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      const assistantMessage = { role: 'assistant', content: data.content }
      setMessages((prev) => [...prev, assistantMessage])
      saveMessage(sessionId, assistantMessage)
    } catch (err) {
      const errorMessage = {
        role: 'assistant',
        content: "Eish, something went wrong on my side. Can you try sending that again?",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex flex-col bg-gray-50" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Top bar */}
      <header className="bg-navy px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <span
            onClick={handleLogoTap}
            className="text-gold font-bold text-lg select-none cursor-default"
          >
            Archie Learn{demoMode ? ' ·' : ''}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-white text-sm opacity-80">
              {name} — Grade {grade}
            </span>
            <button
              onClick={() => setShowLinkCode(true)}
              className="text-white/50 hover:text-gold transition-colors"
              title="Share code with parent"
              aria-label="Generate parent link code"
            >
              <Link2 size={16} />
            </button>
          </div>
        </div>
        <button
          onClick={() => setShowSubjectPicker(!showSubjectPicker)}
          className="flex items-center gap-1 mt-1 text-gold/80 text-xs"
        >
          {subject} <ChevronDown size={14} />
        </button>
      </header>

      {/* Subject picker dropdown */}
      {showSubjectPicker && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              onClick={() => switchSubject(s)}
              className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 last:border-0 ${
                s === subject ? 'text-gold font-semibold bg-navy/5' : 'text-navy'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-base leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gold text-navy rounded-br-sm'
                  : 'bg-navy text-white rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-navy text-white px-4 py-3 rounded-2xl rounded-bl-sm">
              <span className="inline-flex gap-1">
                <span className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 bg-white border-t border-gray-200 px-4 pt-2 pb-4">
        <p className="text-xs text-gray-400 text-center mb-2">
          Archie won't answer until you've had a go first.
        </p>
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 h-12 px-4 border-2 border-gray-200 rounded-full text-base focus:border-navy focus:outline-none transition-colors"
            disabled={loading}
          />
          <button
            type="button"
            className="w-12 h-12 flex items-center justify-center text-gray-400"
            aria-label="Voice input (coming soon)"
          >
            <Mic size={22} />
          </button>
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-12 h-12 bg-navy text-white rounded-full flex items-center justify-center disabled:opacity-40 active:opacity-90 transition-opacity"
            aria-label="Send message"
          >
            <Send size={20} />
          </button>
        </form>
      </div>

      {/* Feedback modal */}
      {showFeedback && (
        <FeedbackModal
          userId={user.id}
          sessionId={sessionId}
          onClose={() => setShowFeedback(false)}
        />
      )}

      {/* Parent link code modal */}
      {showLinkCode && (
        <LinkCodeModal onClose={() => setShowLinkCode(false)} />
      )}
    </div>
  )
}
