import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Server-side Supabase client for rate limit checks
// Uses the anon key — rate_limits RLS allows users to upsert their own rows
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'
const RATE_LIMIT_PER_HOUR = parseInt(process.env.CHAT_RATE_LIMIT || '30')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const { messages, system, userId } = body

  if (!messages || !Array.isArray(messages)) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'messages array is required' }) }
  }

  // Rate limiting — only enforced when userId is provided
  if (userId) {
    const limited = await checkRateLimit(userId, 'chat', RATE_LIMIT_PER_HOUR)
    if (limited) {
      return {
        statusCode: 429,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: `You've sent a lot of messages! Please wait a while before sending more. (Limit: ${RATE_LIMIT_PER_HOUR}/hour)`,
        }),
      }
    }
  }

  // Sanitise messages
  const safeMessages = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({
      role: m.role,
      content: stripHtml(m.content).slice(0, 4000),
    }))
    .slice(-20) // max last 20 messages to control token usage

  const safeSystem = system ? stripHtml(String(system)).slice(0, 8000) : undefined

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      ...(safeSystem ? { system: safeSystem } : {}),
      messages: safeMessages,
    })

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ content: response.content[0].text }),
    }
  } catch (err) {
    console.error('Anthropic API error:', err)

    const isCredits = err.message?.includes('credit') || err.status === 400
    return {
      statusCode: isCredits ? 402 : 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: isCredits
          ? 'API credits are low. Please top up your Anthropic account.'
          : 'Something went wrong with the AI service. Please try again.',
      }),
    }
  }
}

async function checkRateLimit(userId, endpoint, limit) {
  try {
    const windowStart = new Date()
    windowStart.setMinutes(0, 0, 0) // round to current hour

    // Upsert rate limit row
    const { data, error } = await supabase
      .from('rate_limits')
      .upsert({
        user_id: userId,
        endpoint,
        window_start: windowStart.toISOString(),
        request_count: 1,
      }, {
        onConflict: 'user_id,endpoint,window_start',
        ignoreDuplicates: false,
      })
      .select()
      .single()

    // On conflict, increment
    if (error?.code === '23505' || !data) {
      const { data: existing } = await supabase
        .from('rate_limits')
        .select('request_count')
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
        .eq('window_start', windowStart.toISOString())
        .single()

      if (existing && existing.request_count >= limit) return true

      await supabase
        .from('rate_limits')
        .update({ request_count: (existing?.request_count || 0) + 1 })
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
        .eq('window_start', windowStart.toISOString())

      return (existing?.request_count || 0) >= limit
    }

    return (data?.request_count || 0) > limit
  } catch {
    // If rate limit check fails, allow the request (fail open)
    return false
  }
}

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
}
