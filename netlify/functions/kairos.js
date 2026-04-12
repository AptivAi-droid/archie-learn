/**
 * KAIROS — Proactive Learning Coach
 * Based on Claude Code's KAIROS always-on monitor (Anthropic, 2026).
 *
 * On cPanel (no daemon), runs as a scheduled/poll-based trigger.
 * Call this from the frontend on session start to check for nudges.
 * Returns a personalised coaching message if conditions are met.
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

// Trigger thresholds
const INACTIVITY_DAYS = 3        // fire nudge after 3 days inactive
const STUCK_MINUTES = 25         // flag if learner on same concept > 25 min
const LOW_SCORE_THRESHOLD = 0.45 // flag if avg < 45% on last 5 answers

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { userId } = body
  if (!userId) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'userId required' }) }

  try {
    const [profileRes, sessionRes, answersRes, memoryRes] = await Promise.all([
      supabase.from('profiles').select('first_name, grade, subjects').eq('id', userId).single(),
      supabase.from('chat_sessions').select('created_at').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('user_answers').select('ai_score, max_marks, answered_at')
        .eq('user_id', userId).order('answered_at', { ascending: false }).limit(5),
      supabase.from('learner_memory').select('memory_text').eq('user_id', userId).single(),
    ])

    const profile = profileRes.data || {}
    const lastSession = sessionRes.data?.[0]
    const recentAnswers = answersRes.data || []
    const memory = memoryRes.data?.memory_text || ''
    const name = profile.first_name || 'there'

    // ── Check triggers ────────────────────────────────────────────────────
    const triggers = []

    // Inactivity check
    if (lastSession) {
      const daysSince = (Date.now() - new Date(lastSession.created_at)) / (1000 * 60 * 60 * 24)
      if (daysSince >= INACTIVITY_DAYS) {
        triggers.push({ type: 'inactivity', daysSince: Math.round(daysSince) })
      }
    } else {
      triggers.push({ type: 'new_learner' })
    }

    // Low score check
    if (recentAnswers.length >= 3) {
      const avg = recentAnswers.reduce((s, a) => s + (a.ai_score / (a.max_marks || 1)), 0) / recentAnswers.length
      if (avg < LOW_SCORE_THRESHOLD) {
        triggers.push({ type: 'struggling', avgScore: Math.round(avg * 100) })
      }
    }

    // No triggers — learner is on track
    if (triggers.length === 0) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ nudge: null, reason: 'on_track' }),
      }
    }

    // ── Generate personalised nudge ───────────────────────────────────────
    const trigger = triggers[0]
    const nudgePrompt = buildNudgePrompt(name, profile, trigger, memory)

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: nudgePrompt }],
    })

    const nudge = response.content[0].text.trim()

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ nudge, trigger: trigger.type }),
    }

  } catch (err) {
    console.error('KAIROS error:', err)
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'KAIROS check failed.' }) }
  }
}

function buildNudgePrompt(name, profile, trigger, memory) {
  const context = memory ? `\nWhat Archie remembers about this learner:\n${memory.slice(0, 300)}` : ''

  const triggerText = {
    inactivity: `${name} hasn't studied in ${trigger.daysSince} days.`,
    struggling: `${name} is scoring around ${trigger.avgScore}% on recent practice questions — they're struggling.`,
    new_learner: `${name} just signed up and hasn't started their first session yet.`,
  }[trigger.type]

  return `You are Archie, a warm and direct AI tutor for South African high school students.
${context}

Situation: ${triggerText}

Write a single short message (2-3 sentences max) to send ${name} right now. Be warm but direct. Reference something specific if you know it. End with one clear action they can take. Do not use emojis. Do not be sycophantic.`
}
