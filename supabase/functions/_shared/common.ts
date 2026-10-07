// Shared helpers for the Archie Learn Edge Functions (chat, mark).
// Every request must carry the learner's Supabase JWT; the user id is taken from
// the verified token — never from the request body.

import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.46.1"

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://aptivai-droid.github.io"

export const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim()
}

/** Supabase client acting AS the caller (RLS applies) plus the verified user. */
export async function authenticate(
  req: Request,
): Promise<{ user: User; db: SupabaseClient } | Response> {
  const authHeader = req.headers.get("Authorization") ?? ""
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Please log in again." }, 401)

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data, error } = await db.auth.getUser(authHeader.slice(7))
  if (error || !data.user) return json({ error: "Please log in again." }, 401)
  return { user: data.user, db }
}

/** Atomic per-user hourly limit (see bump_rate_limit() in the pilot migration). */
export async function overRateLimit(db: SupabaseClient, endpoint: string, limit: number): Promise<boolean> {
  const { data, error } = await db.rpc("bump_rate_limit", { p_endpoint: endpoint, p_limit: limit })
  if (error) {
    // Fail closed would lock every learner out if the migration is missing — log loudly, allow.
    console.error(`[rate-limit] ${endpoint}: ${error.message}`)
    return false
  }
  return data === true
}

export async function callClaude(params: {
  model: string
  maxTokens: number
  system: string
  messages: { role: "user" | "assistant"; content: string }[]
}): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: params.messages,
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Anthropic ${res.status}: ${detail.slice(0, 500)}`)
  }
  const data = await res.json()
  const block = (data.content ?? []).find((b: { type: string }) => b.type === "text")
  return block?.text ?? ""
}
