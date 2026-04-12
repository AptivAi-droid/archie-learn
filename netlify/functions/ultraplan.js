/**
 * ULTRAPLAN — Deep Learning Planner
 * Based on Claude Code's ULTRAPLAN (offloads complex tasks to Opus 4.6, Anthropic 2026).
 *
 * Uses claude-opus-4-6 for high-depth planning tasks:
 *   - Full 12-week exam prep roadmap
 *   - Subject mastery plan from scratch
 *   - Recovery plan for a learner who is far behind
 *
 * Gated — only fires when explicitly triggered (not on every session).
 * Returns a structured long-form plan saved to supabase: ultraplans table.
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

const PLAN_TYPES = ['exam_prep_12week', 'subject_mastery', 'recovery_plan']

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { userId, planType, context: planContext } = body

  if (!userId) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'userId required' }) }
  if (!PLAN_TYPES.includes(planType)) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: `planType must be one of: ${PLAN_TYPES.join(', ')}` }) }
  }

  try {
    // Fetch learner context
    const [profileRes, memoryRes, progressRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('learner_memory').select('memory_text').eq('user_id', userId).single(),
      supabase.from('user_answers')
        .select('ai_score, max_marks, answered_at')
        .eq('user_id', userId)
        .order('answered_at', { ascending: false })
        .limit(20),
    ])

    const profile = profileRes.data || {}
    const memory = memoryRes.data?.memory_text || 'No prior memory available.'
    const answers = progressRes.data || []

    const avgScore = answers.length > 0
      ? Math.round(answers.reduce((s, a) => s + (a.ai_score / (a.max_marks || 1)), 0) / answers.length * 100)
      : null

    const prompt = buildUltraplanPrompt(planType, profile, memory, avgScore, planContext)

    // ── Opus 4.6 — deep planning model ───────────────────────────────────
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const plan = response.content[0].text.trim()

    // Save to DB
    const { data: saved } = await supabase
      .from('ultraplans')
      .insert({
        user_id: userId,
        plan_type: planType,
        plan_text: plan,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, plan, planId: saved?.id }),
    }

  } catch (err) {
    console.error('ULTRAPLAN error:', err)
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'ULTRAPLAN failed.' }) }
  }
}

function buildUltraplanPrompt(planType, profile, memory, avgScore, extra) {
  const base = `
You are Archie, an expert educational architect for South African high school students (CAPS curriculum).

## Learner
- Name: ${profile.first_name || 'the learner'}
- Grade: ${profile.grade || 'unknown'}
- Subjects: ${(profile.subjects || []).join(', ') || 'not specified'}
- Current avg score: ${avgScore !== null ? avgScore + '%' : 'no data yet'}

## What Archie remembers
${memory.slice(0, 500)}

${extra ? `## Additional context\n${extra}` : ''}
`

  const planInstructions = {
    exam_prep_12week: `
## Task: 12-Week Exam Preparation Roadmap

Build a comprehensive, week-by-week exam preparation plan. Include:
1. A 3-sentence diagnosis of where this learner stands right now
2. Weekly focus: one primary topic per subject per week with specific CAPS outcomes to target
3. Daily session structure recommendation (how long, what type of activity)
4. Revision strategy for the final 2 weeks
5. Predicted risk areas and how to mitigate them
6. A single "north star" goal this learner should hold in mind

Be specific, actionable, and calibrated to CAPS Grade ${profile.grade || '12'} standards.`,

    subject_mastery: `
## Task: Subject Mastery Plan

Build a deep mastery plan for the subject ${extra || 'the learner\'s weakest subject'}. Include:
1. Diagnosis: what level is this learner at and what the core gap is
2. Foundation concepts to lock in first (5 items, in order)
3. 6-week topic progression with clear milestones
4. Practice strategy (how to use Archie's chat and practice modes most effectively)
5. How to know when mastery is achieved (observable markers)

Be specific to the CAPS syllabus.`,

    recovery_plan: `
## Task: Academic Recovery Plan

This learner is behind and needs a recovery plan. Build a structured catch-up plan:
1. Triage: identify the minimum viable topics to pass the exam (not full mastery — strategic coverage)
2. Topics to skip or deprioritise given time constraints
3. A 4-week intensive catch-up schedule
4. Daily minimum viable effort (what is the least they can do and still pass?)
5. Warning signs that the plan is off track
6. One honest sentence about what is and is not achievable in the time remaining

This plan must be realistic, not motivational.`,
  }

  return base + planInstructions[planType]
}
