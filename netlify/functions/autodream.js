/**
 * AutoDream — Memory Consolidation Function
 * Based on Claude Code's services/autoDream/ architecture (Anthropic, 2026).
 *
 * Phases: Orient → Gather → Consolidate → Prune
 * Trigger: Called after every 5 sessions OR manually from the client.
 * Stores consolidated memory in supabase: learner_memory table.
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const MIN_SESSIONS = 5

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { userId, force = false } = body
  if (!userId) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'userId required' }) }

  try {
    // ── Gate 1: Check session count since last consolidation ──────────────
    const { data: memRow } = await supabase
      .from('learner_memory')
      .select('last_consolidated_at, session_count_since_dream')
      .eq('user_id', userId)
      .single()

    const sessionCount = memRow?.session_count_since_dream || 0
    const lastDream = memRow?.last_consolidated_at

    if (!force && sessionCount < MIN_SESSIONS) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          ran: false,
          reason: `Only ${sessionCount}/${MIN_SESSIONS} sessions since last dream.`,
          sessionCount,
        }),
      }
    }

    // ── Gather: pull recent session data ──────────────────────────────────
    const since = lastDream || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [sessionsRes, answersRes, profileRes] = await Promise.all([
      supabase
        .from('chat_sessions')
        .select('created_at, topic, summary')
        .eq('user_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('user_answers')
        .select('question_id, ai_score, max_marks, answered_at, feedback')
        .eq('user_id', userId)
        .gte('answered_at', since)
        .order('answered_at', { ascending: false })
        .limit(50),
      supabase
        .from('profiles')
        .select('first_name, grade, subjects, learning_style')
        .eq('id', userId)
        .single(),
    ])

    const sessions = sessionsRes.data || []
    const answers = answersRes.data || []
    const profile = profileRes.data || {}

    // ── Consolidate: Claude synthesises learner memory ────────────────────
    const consolidationPrompt = buildConsolidationPrompt(profile, sessions, answers)

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: consolidationPrompt }],
    })

    const consolidatedMemory = response.content[0].text

    // ── Prune: upsert consolidated memory to DB ───────────────────────────
    await supabase
      .from('learner_memory')
      .upsert({
        user_id: userId,
        memory_text: consolidatedMemory,
        last_consolidated_at: new Date().toISOString(),
        session_count_since_dream: 0,
        total_dreams: (memRow?.total_dreams || 0) + 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ran: true,
        sessionCount,
        memorySummary: consolidatedMemory.slice(0, 200) + '...',
      }),
    }

  } catch (err) {
    console.error('AutoDream error:', err)
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Dream consolidation failed.' }) }
  }
}

function buildConsolidationPrompt(profile, sessions, answers) {
  const avgScore = answers.length > 0
    ? Math.round(answers.reduce((s, a) => s + ((a.ai_score || 0) / (a.max_marks || 1)), 0) / answers.length * 100)
    : null

  const weakAreas = answers
    .filter(a => (a.ai_score / (a.max_marks || 1)) < 0.5)
    .map(a => a.question_id)
    .slice(0, 5)

  return `You are performing a Dream — a memory consolidation pass for a learner named ${profile.first_name || 'this student'}.

## Learner Profile
- Grade: ${profile.grade || 'unknown'}
- Subjects: ${(profile.subjects || []).join(', ') || 'not specified'}
- Learning style: ${profile.learning_style || 'not specified'}

## Recent Activity (since last Dream)
- Sessions completed: ${sessions.length}
- Topics covered: ${sessions.map(s => s.topic || 'general').join(', ') || 'none recorded'}
- Questions answered: ${answers.length}
- Average score: ${avgScore !== null ? avgScore + '%' : 'no data'}
- Struggling areas (question IDs): ${weakAreas.length ? weakAreas.join(', ') : 'none identified'}

## Instructions
Produce a concise memory file (under 400 words) that captures:

1. **Learning Velocity** — Is this learner progressing well, plateauing, or declining? One sentence.
2. **Strengths** — What concepts/topics are they handling confidently?
3. **Weak Points** — Where do they consistently struggle? Be specific.
4. **Preferred Patterns** — What session patterns work best for them (short bursts, long sessions, topic variety, drill repetition)?
5. **Next Focus** — Top 2 things Archie should prioritise in the next 5 sessions.
6. **Learner Note** — One sentence Archie can use to open the next session that shows it remembers them.

Write in concise, factual prose. No headers needed. This memory will be injected into Archie's system prompt to personalise future tutoring sessions.`
}
