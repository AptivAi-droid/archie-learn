// Archie Learn — AI vetting agent for teacher/parent signup applications
// Receives application data, calls Claude to vet, auto-creates account if approved.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1"

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS })
  }

  try {
    const body = await req.json()
    const { email, password, role, dob, application_data } = body

    if (!email || !password || !role || !dob || !application_data) {
      return json({ error: "Missing required fields" }, 400)
    }
    if (!["teacher", "parent"].includes(role)) {
      return json({ error: "Role must be teacher or parent" }, 400)
    }
    if (password.length < 8) {
      return json({ error: "Password must be at least 8 characters" }, 400)
    }

    const age = computeAge(dob)
    if (age < 18) {
      return json({ error: "Adult signup is for ages 18 and older. Please sign up as a student." }, 400)
    }

    // Rate limit: max 3 applications per email in 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("signup_applications")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since)

    if ((count ?? 0) >= 3) {
      return json({ error: "Too many applications from this email today. Please try again tomorrow or contact your admin." }, 429)
    }

    // AI vetting
    const aiResult = await vetWithClaude({ email, role, dob, age, application_data })

    // Base application row
    const appRow: Record<string, unknown> = {
      email,
      requested_role: role,
      dob,
      application_data,
      ai_decision: aiResult.decision,
      ai_confidence: aiResult.confidence,
      ai_reasoning: aiResult.reasoning,
      ai_red_flags: aiResult.red_flags,
    }

    if (aiResult.decision === "APPROVED") {
      // Auto-create the account
      const { data: created, error: userErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { dob, role },
      })
      if (userErr || !created?.user) {
        // If creation failed (e.g. email already exists), record but don't expose
        appRow.ai_decision = "NEEDS_REVIEW"
        appRow.ai_reasoning = (aiResult.reasoning || "") + " | Account creation failed: " + (userErr?.message || "unknown")
        await supabase.from("signup_applications").insert(appRow)
        return json({
          outcome: "NEEDS_REVIEW",
          message: "Thanks — our team will review your application within 24 hours.",
        })
      }

      // Set role in profiles
      await supabase.from("profiles").upsert({
        id: created.user.id,
        role,
        dob,
      })

      appRow.created_user_id = created.user.id
      await supabase.from("signup_applications").insert(appRow)

      return json({
        outcome: "APPROVED",
        message: "Account created. You can now log in.",
        email,
      })
    }

    // NEEDS_REVIEW or REJECTED
    await supabase.from("signup_applications").insert(appRow)

    if (aiResult.decision === "NEEDS_REVIEW") {
      return json({
        outcome: "NEEDS_REVIEW",
        message: "Thanks — our team will review your application and email you within 24 hours.",
      })
    }

    return json({
      outcome: "REJECTED",
      message: "We couldn't verify your application. " + (aiResult.reasoning || "Please refine and resubmit, or contact your administrator."),
      red_flags: aiResult.red_flags,
    })
  } catch (e) {
    console.error("vet-application error:", e)
    return json({ error: "Server error. Please try again." }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

function computeAge(dobIso: string): number {
  const dob = new Date(dobIso)
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

async function vetWithClaude(input: {
  email: string
  role: string
  dob: string
  age: number
  application_data: Record<string, unknown>
}) {
  const prompt = `You are an admissions vetting agent for Archie Learn, an AI tutoring web app for South African high school students (Grades 8-12, CAPS curriculum). Adults (teachers and parents) need to apply for accounts; students self-signup with a DOB check.

YOUR JOB: Assess if this application looks legitimate.

APPLICATION:
- Email: ${input.email}
- Email domain: ${input.email.split("@")[1] || "unknown"}
- DOB: ${input.dob} (age: ${input.age})
- Requested role: ${input.role}
- Application data: ${JSON.stringify(input.application_data, null, 2)}

EVALUATION GUIDELINES:
- Plausibility: are details coherent? Or are they "test", "asdf", single chars, gibberish?
- Age: teachers typically 21+, parents 25+. Anyone under those ranges is uncommon but possible — flag without rejecting.
- For TEACHER applications: school name should look like a real SA school, subjects should match CAPS curriculum (Mathematics, Physical Sciences, Life Sciences, English, Afrikaans, History, Geography, Accounting, Business Studies, etc.), "why_join" should be a coherent reason an adult would write.
- For PARENT applications: child name + grade + school should look real. If they provide a 6-character link code or existing student email, that's a STRONG positive signal (confidence +0.2).
- Email domain: SA school/government domains (*.gov.za, *.edu, *.ac.za, *.org.za, *.co.za with school name) bump confidence. Generic (gmail, yahoo, outlook) is neutral, not a negative.

DECISION RULES (strict):
- APPROVED only if confidence >= 0.85 AND zero red flags AND application looks legitimate.
- NEEDS_REVIEW for borderline cases (confidence 0.5-0.85) or one minor concern.
- REJECTED if confidence < 0.5 OR multiple red flags OR obvious test data ("asdf", "test test", repeated chars).

Return ONLY this JSON, nothing else (no prose, no markdown fences, no explanation):
{"decision":"APPROVED|NEEDS_REVIEW|REJECTED","confidence":0.0,"reasoning":"...","red_flags":[]}`

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    const data = await resp.json()
    const text = data.content?.[0]?.text || ""

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON in Claude response")
    const parsed = JSON.parse(match[0])

    return {
      decision: ["APPROVED", "NEEDS_REVIEW", "REJECTED"].includes(parsed.decision)
        ? parsed.decision
        : "NEEDS_REVIEW",
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      reasoning: String(parsed.reasoning || "").slice(0, 500),
      red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags.slice(0, 10).map(String) : [],
    }
  } catch (e) {
    console.error("Claude vetting failed:", e)
    return {
      decision: "NEEDS_REVIEW" as const,
      confidence: 0.5,
      reasoning: "AI vetting unavailable — queued for manual admin review.",
      red_flags: ["ai_unavailable"],
    }
  }
}
