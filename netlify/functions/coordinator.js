/**
 * COORDINATOR — Curriculum Generation Swarm
 * Based on Claude Code's coordinator/coordinatorMode.ts (Anthropic, 2026).
 *
 * Orchestrates 4 parallel Claude calls to generate a personalised curriculum:
 *   Worker 1 — Map learning objectives
 *   Worker 2 — Assess baseline knowledge
 *   Worker 3 — Sequence content with dependencies
 *   Worker 4 — Generate Week 1 lesson plan
 *
 * Fires once on learner onboarding. Saves to supabase: curricula table.
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

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { userId, profile } = body
  if (!userId || !profile) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'userId and profile required' }) }

  const { first_name, grade, subjects = [], exam_year, weak_areas = [], strong_areas = [] } = profile

  try {
    // ── Coordinator fires 4 workers in parallel ───────────────────────────
    const [objectivesRes, baselineRes, sequenceRes, week1Res] = await Promise.all([

      // Worker 1: Map learning objectives
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: `
You are a curriculum specialist for South African CAPS high school curriculum.
Student: Grade ${grade}, subjects: ${subjects.join(', ')}, exam year: ${exam_year || 'not specified'}.
List the top 8 core learning objectives this student must master before finals.
Format: numbered list, one line each. Be specific to CAPS syllabus. No preamble.` }],
      }),

      // Worker 2: Assess baseline and gaps
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: `
You are an educational diagnostician.
Student: Grade ${grade}, self-reported strong areas: ${strong_areas.join(', ') || 'none'}, weak areas: ${weak_areas.join(', ') || 'none'}.
Subjects: ${subjects.join(', ')}.
Identify the 3 most critical knowledge gaps to address in the first month. One sentence each. No preamble.` }],
      }),

      // Worker 3: Sequence 8-week content path
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        messages: [{ role: 'user', content: `
You are a curriculum sequencer for CAPS Grade ${grade}.
Subjects: ${subjects.join(', ')}. Weak areas: ${weak_areas.join(', ') || 'general revision'}.
Design an 8-week study sequence. Each week: one focus topic per subject.
Format: "Week N: [Subject] — [Topic]" on each line. Prioritise weak areas first. No preamble.` }],
      }),

      // Worker 4: Week 1 detailed lesson plan
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: `
You are a lesson planner for a South African Grade ${grade} student named ${first_name || 'the learner'}.
Subjects: ${subjects.join(', ')}. Biggest gap: ${weak_areas[0] || 'general revision'}.
Write a 5-session Week 1 lesson plan (Mon-Fri). Each session: 20-30 min.
Format: "Day N (Subject): [Activity] — [Goal]". Be specific and actionable. No preamble.` }],
      }),
    ])

    // ── Synthesise coordinator output ────────────────────────────────────
    const curriculum = {
      objectives: objectivesRes.content[0].text.trim(),
      gaps: baselineRes.content[0].text.trim(),
      eightWeekPlan: sequenceRes.content[0].text.trim(),
      week1Plan: week1Res.content[0].text.trim(),
      generatedAt: new Date().toISOString(),
      grade,
      subjects,
    }

    // ── Save to Supabase ─────────────────────────────────────────────────
    await supabase
      .from('curricula')
      .upsert({
        user_id: userId,
        curriculum_data: curriculum,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, curriculum }),
    }

  } catch (err) {
    console.error('Coordinator error:', err)
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Curriculum generation failed.' }) }
  }
}
