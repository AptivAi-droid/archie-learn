import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '..', '.env'), override: true })
import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, system } = req.body

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' })
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    })

    const content = response.content[0]?.text || ''
    res.json({ content })
  } catch (err) {
    console.error('Anthropic API error:', err.message)
    const msg = err.message || JSON.stringify(err.error) || ''
    if (msg.includes('credit balance') || msg.includes('billing')) {
      res.status(402).json({ error: 'Archie is taking a quick break. The API credits need topping up.' })
    } else {
      res.status(500).json({ error: 'Eish, something went wrong on my side. Can you try sending that again?' })
    }
  }
})

app.listen(PORT, () => {
  console.log(`Archie Learn server running on port ${PORT}`)
})
