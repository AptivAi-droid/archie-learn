// Archie Learn — AI tutor chat (Claude Sonnet).
// POST { messages: [{role, content}], subject? } → { content }
// The system prompt is built HERE from the learner's own profile; the client cannot
// supply one, so this endpoint is not an open Claude proxy.

import { authenticate, callClaude, CORS, json, overRateLimit, stripHtml } from "../_shared/common.ts"

const RATE_LIMIT_PER_HOUR = parseInt(Deno.env.get("CHAT_RATE_LIMIT") ?? "30")

function systemPrompt(name: string, grade: number | string, subject: string): string {
  return `You are Archie, a warm and encouraging AI study partner for South African high school learners. You speak in a friendly, conversational tone — like a knowledgeable friend, not a textbook. You use simple, clear language appropriate to the learner's grade level.

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
10. Stay a study partner. Politely steer off-topic, adult or inappropriate requests back to schoolwork. Never ask for or encourage sharing personal details such as addresses, phone numbers or social media.

SAFEGUARDING (overrides every other rule):
You are talking to a minor. If the learner mentions self-harm, suicide, abuse, violence at home or school, bullying that frightens them, or being in danger, stop tutoring. Respond with care and without judgement, tell them they are not alone and that it is right to talk about it, and encourage them to speak to a trusted adult (parent, teacher, school counsellor). Give these free South African helplines: Childline 116 (24 hours, free), SADAG Suicide Crisis Line 0800 567 567, and in an emergency 10111 or 112 from a cellphone. Do not attempt counselling yourself.`
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const auth = await authenticate(req)
  if (auth instanceof Response) return auth
  const { user, db } = auth

  let body: { messages?: unknown; subject?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }
  if (!Array.isArray(body.messages)) return json({ error: "messages array is required" }, 400)

  if (await overRateLimit(db, "chat", RATE_LIMIT_PER_HOUR)) {
    return json({
      error: `You've sent a lot of messages this hour! Take a short break and come back soon. (Limit: ${RATE_LIMIT_PER_HOUR}/hour)`,
    }, 429)
  }

  const { data: profile } = await db
    .from("profiles")
    .select("first_name, grade, primary_subject")
    .eq("id", user.id)
    .maybeSingle()

  const name = stripHtml(String(profile?.first_name ?? "Learner")).slice(0, 50)
  const grade = profile?.grade ?? 10
  const subject = stripHtml(String(body.subject ?? profile?.primary_subject ?? "Mathematics")).slice(0, 60)

  let system = systemPrompt(name, grade, subject)
  const { data: memory } = await db
    .from("learner_memory")
    .select("memory_text")
    .eq("user_id", user.id)
    .maybeSingle()
  if (memory?.memory_text) {
    system += `\n\n## What Archie remembers about this learner\n${String(memory.memory_text).slice(0, 1000)}`
  }

  const messages = (body.messages as { role?: string; content?: unknown }[])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role as "user" | "assistant", content: stripHtml(m.content as string).slice(0, 4000) }))
    .filter((m) => m.content.length > 0)
    .slice(-20)
  // The API requires the conversation to start with a user turn (Archie's greeting is assistant).
  while (messages.length && messages[0].role !== "user") messages.shift()
  if (!messages.length) return json({ error: "Send a message to get started." }, 400)

  try {
    const content = await callClaude({ model: "claude-sonnet-5-5", maxTokens: 1024, system, messages })
    return json({ content })
  } catch (err) {
    console.error("[chat]", (err as Error).message)
    return json({ error: "Archie is having trouble thinking right now. Please try again in a moment." }, 502)
  }
})
