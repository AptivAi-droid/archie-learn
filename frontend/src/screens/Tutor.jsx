import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { chat, ApiError } from '../lib/api'
import { Send, ChevronDown, Link2, Loader2 } from 'lucide-react'
import FeedbackModal from '../components/FeedbackModal'
import LinkCodeModal from '../components/LinkCodeModal'
import { SUBJECTS } from '../data/subjects'
import { sanitizeInput } from '../lib/sanitize'
import { getDemoResponse, isDemoMode, toggleDemoMode, DEMO_ALLOWED } from '../lib/demoResponses'

const UNREACHABLE_MESSAGE =
  "I can't reach Archie right now. Check your internet connection and try again in a moment."
const GENERIC_ERROR_MESSAGE =
  "Eish, something went wrong on my side. Can you try sending that again?"

// Same text the server stores as the first message of a new session
function greetingFor(firstName) {
  return `Hey ${firstName}! What are we working on today?`
}

export default function Tutor() {
  const { profile, saveProfile } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  // Server-owned chat session. null until the first message — the server then creates
  // it (storing the greeting first) and returns its id. Opening the tutor or switching
  // subject therefore never counts as a study session.
  const [sessionId, setSessionId] = useState(null)
  // Bumped on every reset so replies for an abandoned conversation are ignored
  const conversationRef = useRef(0)
  const [messageCount, setMessageCount] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showSubjectPicker, setShowSubjectPicker] = useState(false)
  const [showLinkCode, setShowLinkCode] = useState(false)
  const [demoMode, setDemoMode] = useState(isDemoMode)
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef(null)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  // Triple-tap logo to toggle demo mode — only exists in builds with VITE_ALLOW_DEMO=true
  const handleLogoTap = useCallback(() => {
    if (!DEMO_ALLOWED) return
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

  function startSession() {
    // Reset locally only — the server creates the session on the first message.
    // The greeting is shown locally exactly as the server will store it.
    conversationRef.current++
    setSessionId(null)
    setMessages([{ role: 'assistant', content: greetingFor(name) }])
    setMessageCount(0)
    setLoading(false)
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
    const nextCount = messageCount + 1
    const conversation = conversationRef.current
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setMessageCount(nextCount)

    if (demoMode) {
      // Demo mode (VITE_ALLOW_DEMO builds only): simulated, unsaved response with typing delay
      const delay = 800 + Math.random() * 1500 // 0.8–2.3 seconds
      await new Promise((r) => setTimeout(r, delay))
      if (conversation !== conversationRef.current) return
      const demoContent = getDemoResponse(name, subject, nextCount, safeInput)
      setMessages((prev) => [...prev, { role: 'assistant', content: demoContent }])
      setLoading(false)
      inputRef.current?.focus()
      return
    }

    try {
      // The server stores the message, loads the history itself and returns the reply
      const data = await chat.send({ session_id: sessionId, subject, content: safeInput })
      if (conversation !== conversationRef.current) return
      if (data?.session_id) setSessionId(data.session_id)
      setMessages((prev) => [...prev, { role: 'assistant', content: data?.reply?.content || GENERIC_ERROR_MESSAGE }])
    } catch (err) {
      if (conversation !== conversationRef.current) return
      // A 502 still saved the learner message — keep using that session if the server says which
      if (err instanceof ApiError && err.data?.session_id) setSessionId(err.data.session_id)
      // Show the server's message verbatim (e.g. the 429 rate-limit or 502 AI-failure notice)
      let content = GENERIC_ERROR_MESSAGE
      if (err instanceof ApiError) {
        content = err.code === 'NETWORK' || err.code === 'TIMEOUT' ? UNREACHABLE_MESSAGE : err.message
      }
      setMessages((prev) => [...prev, { role: 'assistant', error: true, content }])
    } finally {
      if (conversation === conversationRef.current) {
        setLoading(false)
        inputRef.current?.focus()
      }
    }
  }

  return (
    <div className="flex flex-col bg-gray-50" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Top bar */}
      <header className="bg-navy px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <span
            onClick={handleLogoTap}
            className="font-display font-extrabold text-lg tracking-tight text-gold select-none cursor-default"
          >
            Archie Learn{DEMO_ALLOWED && demoMode ? ' ·' : ''}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-white text-sm opacity-80">
              {name} — Grade {grade}
            </span>
            <button
              onClick={() => setShowLinkCode(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-white/50 hover:text-gold hover:bg-white/5 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold transition-[color,background-color,transform] duration-200"
              title="Share code with parent"
              aria-label="Generate parent link code"
            >
              <Link2 size={16} />
            </button>
          </div>
        </div>
        <button
          onClick={() => setShowSubjectPicker(!showSubjectPicker)}
          aria-expanded={showSubjectPicker}
          className="flex items-center gap-1 mt-1 text-gold/80 hover:text-gold text-xs rounded active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold transition-[color,transform] duration-150"
        >
          {subject}
          <ChevronDown size={14} className={`transition-transform duration-200 ${showSubjectPicker ? 'rotate-180' : ''}`} />
        </button>
      </header>

      {/* Subject picker dropdown */}
      {showSubjectPicker && (
        <div className="bg-paper border-b border-rule shadow-sm animate-dropdown-in">
          {SUBJECTS.map((s) => {
            const active = s === subject
            return (
              <button
                key={s}
                onClick={() => switchSubject(s)}
                aria-current={active || undefined}
                className={`w-full text-left pl-3 pr-4 py-3 text-sm border-b border-rule border-l-4 last:border-b-0 transition-colors duration-150 hover:bg-paper-2 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${
                  active ? 'text-navy font-semibold bg-gold/10 border-l-gold' : 'text-ink border-l-transparent'
                }`}
              >
                {s}
              </button>
            )
          })}
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex animate-message-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-base leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gold text-navy rounded-br-sm'
                  : msg.error
                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                    : 'bg-navy text-white rounded-bl-sm'
              }`}
              role={msg.error ? 'alert' : undefined}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-message-in">
            <div className="bg-navy text-white px-4 py-3 rounded-2xl rounded-bl-sm" role="status">
              <span className="sr-only">Archie is typing…</span>
              <span className="inline-flex gap-1" aria-hidden="true">
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
      <div className="shrink-0 bg-paper border-t border-rule px-4 pt-2 pb-4">
        <p className="text-xs text-muted text-center mb-2">
          Archie won't answer until you've had a go first.
        </p>
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 h-12 px-4 border-2 border-rule-2 rounded-full text-base bg-paper hover:bg-paper-2 focus:border-ink-2 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus transition-colors duration-200"
            aria-label="Message to Archie"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-12 h-12 bg-navy text-white rounded-full flex items-center justify-center disabled:opacity-40 hover:bg-ink-2 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus transition-[background-color,transform] duration-150"
            aria-label={loading ? 'Sending…' : 'Send message'}
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </form>
      </div>

      {/* Feedback modal */}
      {showFeedback && (
        <FeedbackModal
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
