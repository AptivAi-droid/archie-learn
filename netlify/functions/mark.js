import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
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
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { question, modelAnswer, studentAnswer, marks, subject, grade } = body

  if (!question || !modelAnswer || !studentAnswer || !marks) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Missing required fields: question, modelAnswer, studentAnswer, marks' }),
    }
  }

  // Sanitise inputs
  const safeQuestion = String(question).slice(0, 2000)
  const safeModel = String(modelAnswer).slice(0, 2000)
  const safeStudent = String(studentAnswer).slice(0, 3000)
  const safeMarks = Math.min(Math.max(parseInt(marks) || 4, 1), 20)

  const systemPrompt = `You are an expert South African high school exam marker working with the CAPS curriculum.
You are fair, encouraging and thorough. You mark a student's answer against a model answer and award marks.

Rules:
1. Award marks based on the quality of the student's answer relative to the model answer.
2. Give partial credit when the student gets part of the answer correct.
3. Never give more marks than the maximum available.
4. Be specific in your feedback — tell the student exactly what they got right and what they missed.
5. End with an encouraging note (one sentence) appropriate for a South African high school student.
6. Respond ONLY with valid JSON in this exact format:
{
  "score": <integer from 0 to max_marks>,
  "feedback": "<2-4 sentences of specific feedback>",
  "encouragement": "<one encouraging sentence>"
}`

  const userPrompt = `Subject: ${subject || 'General'} | Grade: ${grade || '10'} | Maximum marks: ${safeMarks}

QUESTION:
${safeQuestion}

MODEL ANSWER:
${safeModel}

STUDENT'S ANSWER:
${safeStudent}

Mark this answer and respond with JSON only.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content[0].text.trim()

    let result
    try {
      result = JSON.parse(text)
    } catch {
      // Try to extract JSON from response if model added extra text
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        result = JSON.parse(match[0])
      } else {
        throw new Error('Model returned non-JSON response')
      }
    }

    // Clamp score to valid range
    result.score = Math.min(Math.max(parseInt(result.score) || 0, 0), safeMarks)

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        score: result.score,
        maxMarks: safeMarks,
        feedback: result.feedback || 'Good attempt.',
        encouragement: result.encouragement || 'Keep going — you are improving!',
      }),
    }
  } catch (err) {
    console.error('Mark function error:', err)
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Marking service temporarily unavailable. Please try again.' }),
    }
  }
}
