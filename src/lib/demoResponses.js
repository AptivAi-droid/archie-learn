// Demo mode: realistic Archie responses that simulate Socratic tutoring
// Responses are context-aware based on subject, message count, and keywords

const GREETINGS = [
  (name, subject) => `Great choice! ${subject} it is. So what topic or problem are you working on right now, ${name}?`,
  (name, subject) => `Sharp sharp, let's get into ${subject}! Tell me what you're busy with — homework, revision, or something you're stuck on?`,
  (name, subject) => `${subject} — one of my favourites! What do you need help with today, ${name}?`,
]

const SOCRATIC_FIRST = [
  (name) => `Okay, interesting! Before I say anything — what do you already know about this? Tell me what you've tried so far, ${name}.`,
  (name) => `Good question! But first — have you had a go at it yourself? I want to see what you're thinking before I jump in.`,
  (name) => `I like that you're asking about this — it's an important concept. What's your first instinct? Even if you're not sure, give it a try.`,
  (name) => `Alright, let's work through this together. But you go first — what do you think the first step would be?`,
]

const ENCOURAGEMENT = [
  (name) => `You're on the right track, ${name}! That's a solid start. Now, can you take it one step further?`,
  (name) => `Sharp sharp! You've got the basic idea. Let me ask you this — what happens next if you follow that logic?`,
  (name) => `That's it, ${name}! You're getting closer. Think about what connects to what you just said.`,
  (name) => `Nice thinking! You're almost there. Let me give you a small nudge — think about how this relates to what you learned about the previous topic.`,
]

const HINTS = [
  (name) => `Okay ${name}, here's a hint: think about it like this — if you were at a spaza shop and needed to work this out in your head, what would you do first?`,
  (name) => `Let me help you out a bit. Remember the formula we'd normally use here? Try writing it out and plugging in what you know.`,
  (name) => `I can see you're thinking hard about this. Here's a clue — break the problem into two smaller parts. What's the easier part you can solve first?`,
  (name) => `You're close! Think about it this way — what stays the same, and what changes? That'll help you see the pattern.`,
]

const FRUSTRATION_SUPPORT = [
  (name) => `Hey ${name}, it's completely okay to find this hard — that's actually a sign you're learning something new. Let's slow down and take it one piece at a time. What part confuses you the most?`,
  (name) => `I hear you, ${name}. This stuff isn't easy, and the fact that you're still here trying says a lot about you. Let's approach it from a different angle — forget the textbook for a sec. In your own words, what do you think is happening here?`,
  (name) => `Don't give up on me now! Everyone gets stuck — even the top students. The difference is they keep going. Let me simplify this for you. What's the one thing you DO understand about this so far?`,
]

const SUBJECT_RESPONSES = {
  Mathematics: {
    topics: [
      (name) => `Right, so with this type of equation, the key is to isolate the variable. What operation would you use to get x by itself, ${name}?`,
      (name) => `Think about what the gradient tells us. If you were walking up a hill in Cape Town, a steeper hill would mean what for the gradient value?`,
      (name) => `Good effort! Now remember — when we multiply both sides, we have to do it to every single term. Can you try that again?`,
      (name) => `Let's think about this with real numbers. If a taxi ride costs R15 for the first 3km and R3 per km after that, how would you write the equation for the total cost?`,
      (name) => `You've got the right formula! Now substitute the values in carefully — watch your signs. Negative times negative gives you what?`,
    ],
  },
  'Physical Sciences': {
    topics: [
      (name) => `Okay, so Newton's second law — F equals ma. If a Springbok rugby player with a mass of 95kg accelerates at 3 m/s², what's the net force? Have a go, ${name}.`,
      (name) => `Right, energy can't be created or destroyed — only transferred. So if the ball is at the top of the hill, what type of energy does it have? And what happens to that energy as it rolls down?`,
      (name) => `Think about it this way: the current in a series circuit is the same everywhere. So if one bulb uses 2A, what does the next bulb get?`,
      (name) => `Good thinking! Now remember, for balanced chemical equations, the number of atoms on the left must equal the right. Count your oxygens again — how many do you have on each side?`,
    ],
  },
  'Life Sciences': {
    topics: [
      (name) => `Let's think about photosynthesis. The plant takes in CO₂ and water, and uses sunlight to make what two things, ${name}?`,
      (name) => `Good! Now with mitosis versus meiosis — the key difference is the number of divisions. How many times does the cell divide in each process?`,
      (name) => `Think about natural selection like this: if there's a drought in the Karoo, which plants are more likely to survive — the ones with deep roots or shallow roots? And what does that mean for the next generation?`,
      (name) => `You're right that DNA carries the genetic code! Now, if one strand reads A-T-G-C, what would the complementary strand look like? Remember the base pairing rules.`,
    ],
  },
  'English Home Language': {
    topics: [
      (name) => `Great question about literary devices! Before I explain, can you tell me what YOU think the author was trying to achieve with that metaphor, ${name}?`,
      (name) => `When we analyse a poem, we look at more than just what the words say — we look at how they make us feel. Read that stanza again. What mood does it create for you?`,
      (name) => `For your essay structure, think of it like building a house — you need a strong foundation first. What's your thesis statement? Once you nail that, everything else follows.`,
      (name) => `Good attempt at the comprehension! Now, the question asks for a "critical" response. That means you can't just say what happened — you need to say WHY it matters. Try again with that in mind.`,
    ],
  },
  History: {
    topics: [
      (name) => `Okay, so when we look at this historical source, the first thing to ask is: who wrote it, and why? What do you think their perspective or bias might be, ${name}?`,
      (name) => `Think about the causes of this event — there's never just one. What were the political factors? And how did the economic situation at the time contribute?`,
      (name) => `Good analysis! Now, the CAPS exam will ask you to evaluate the source. That means weighing up its reliability. What makes a source reliable or unreliable?`,
      (name) => `Remember, when writing a history essay for CAPS, you need to take a clear position and support it with evidence. What's your argument here?`,
    ],
  },
}

const WALKTHROUGH = [
  (name) => `Okay ${name}, you've given it a really good try. Let me walk you through this step by step. First, we need to identify what we know and what we're looking for. Then we'll apply the right method. Ready? Here we go...`,
  (name) => `You've worked hard on this, ${name}. Let me break it down for you now. The trick here is to start with the basics and build up. Step one is to...`,
]

const CELEBRATION = [
  (name) => `Sharp sharp, ${name}! That's it! You've got it now. See? You knew more than you thought you did. Want to try another one to lock it in?`,
  (name) => `That's it! Boom! ${name}, you just nailed it. That's the kind of thinking that gets distinctions. Ready for the next challenge?`,
  (name) => `Yes! You've got it, ${name}! That was a tricky one and you worked through it. I'm proud of you. Shall we keep going?`,
]

// Detect intent from user message
function detectIntent(message) {
  const lower = message.toLowerCase()

  if (/^(hi|hey|hello|howzit|sup|yo)\b/.test(lower)) return 'greeting'
  if (/i (don'?t|dont) (understand|know|get)/.test(lower)) return 'frustrated'
  if (/(hard|difficult|confused|stuck|give up|can'?t|hate|impossible)/.test(lower)) return 'frustrated'
  if (/^(yes|yeah|yep|ja|correct|right|i think so)/i.test(lower)) return 'affirmative'
  if (/\b(answer|solve|what is|calculate|find|how do|explain|help)\b/.test(lower)) return 'asking'
  if (/\b(i got|my answer|i think|i tried|here'?s|result is|= ?[\d])/i.test(lower)) return 'attempting'
  if (/\?$/.test(message.trim())) return 'asking'

  return 'general'
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function getDemoResponse(name, subject, messageCount, userMessage) {
  const intent = detectIntent(userMessage)
  const subjectData = SUBJECT_RESPONSES[subject] || SUBJECT_RESPONSES['Mathematics']

  // First user message after "what are we working on" — greet with subject
  if (messageCount <= 1) {
    return pickRandom(GREETINGS)(name, subject)
  }

  // Handle frustration immediately with warmth
  if (intent === 'frustrated') {
    return pickRandom(FRUSTRATION_SUPPORT)(name)
  }

  // Student is greeting
  if (intent === 'greeting') {
    return `Hey ${name}! Good to see you. What are we tackling today?`
  }

  // Student confirms or gives short affirmative
  if (intent === 'affirmative') {
    return pickRandom(ENCOURAGEMENT)(name)
  }

  // Student is attempting an answer
  if (intent === 'attempting') {
    // Alternate between encouragement and deeper probing
    if (messageCount % 3 === 0) {
      return pickRandom(CELEBRATION)(name)
    }
    return pickRandom(ENCOURAGEMENT)(name)
  }

  // Student is asking a question — Socratic response
  if (intent === 'asking') {
    if (messageCount <= 3) {
      return pickRandom(SOCRATIC_FIRST)(name)
    }
    if (messageCount <= 6) {
      return pickRandom(subjectData.topics)(name)
    }
    if (messageCount <= 8) {
      return pickRandom(HINTS)(name)
    }
    // After many attempts, walk through
    return pickRandom(WALKTHROUGH)(name)
  }

  // General / topic-specific response
  if (messageCount <= 4) {
    return pickRandom(SOCRATIC_FIRST)(name)
  }
  if (messageCount <= 7) {
    return pickRandom(subjectData.topics)(name)
  }
  if (messageCount <= 9) {
    return pickRandom(HINTS)(name)
  }

  return pickRandom(ENCOURAGEMENT)(name)
}

// Check if demo mode is enabled
export function isDemoMode() {
  return localStorage.getItem('archie-demo-mode') === 'true'
}

// Toggle demo mode
export function toggleDemoMode() {
  const current = isDemoMode()
  localStorage.setItem('archie-demo-mode', current ? 'false' : 'true')
  return !current
}
