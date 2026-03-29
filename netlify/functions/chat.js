import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { messages, system } = JSON.parse(event.body)

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ content: response.content[0].text }),
    }
  } catch (err) {
    console.error('Anthropic API error:', err)

    const isCredits = err.message?.includes('credit') || err.status === 400
    return {
      statusCode: isCredits ? 402 : 500,
      headers,
      body: JSON.stringify({
        error: isCredits
          ? 'API credits are low. Please top up your Anthropic account.'
          : 'Something went wrong with the AI service.',
      }),
    }
  }
}
