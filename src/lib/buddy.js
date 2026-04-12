/**
 * BUDDY SYSTEM — Archie Learn Companion
 * Based on Claude Code's buddy/ architecture (Anthropic, 2026).
 * Deterministic species assignment via Mulberry32 PRNG seeded from userId.
 */

// ─── Mulberry32 PRNG (same algorithm as Claude Code source) ─────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashUserId(userId) {
  let h = 0
  for (let i = 0; i < userId.length; i++) {
    h = Math.imul(31, h) + userId.charCodeAt(i) | 0
  }
  return Math.abs(h)
}

// ─── 18 Species (Common → Legendary) ────────────────────────────────────────
export const SPECIES = [
  // Common (6)
  { id: 'pebblecrab',   name: 'Pebblecrab',   rarity: 'Common',    emoji: '🦀', colour: '#A0AEC0', soul: 'Steady and grounded. Finds comfort in repetition.' },
  { id: 'dustbunny',    name: 'Dustbunny',    rarity: 'Common',    emoji: '🐇', colour: '#CBD5E0', soul: 'Always in motion. Attention drifts like dust on wind.' },
  { id: 'inkworm',      name: 'Inkworm',      rarity: 'Common',    emoji: '🐛', colour: '#9AE6B4', soul: 'Quiet reader. Absorbs everything, says little.' },
  { id: 'sparknub',     name: 'Sparknub',     rarity: 'Common',    emoji: '⚡', colour: '#FAF089', soul: 'Short bursts of energy. Brilliant then exhausted.' },
  { id: 'cliffhop',    name: 'Cliffhop',     rarity: 'Common',    emoji: '🐸', colour: '#68D391', soul: 'Takes big leaps without looking. Somehow lands.' },
  { id: 'mudsnail',    name: 'Mudsnail',     rarity: 'Common',    emoji: '🐌', colour: '#F6AD55', soul: 'Slow but never stops. Finishes what others abandon.' },
  // Uncommon (5)
  { id: 'glintfish',   name: 'Glintfish',    rarity: 'Uncommon',  emoji: '🐟', colour: '#63B3ED', soul: 'Moves in flashes. Understands things intuitively.' },
  { id: 'thornwing',   name: 'Thornwing',    rarity: 'Uncommon',  emoji: '🦋', colour: '#B794F4', soul: 'Sharp and elegant. Transforms under pressure.' },
  { id: 'vaultmole',   name: 'Vaultmole',    rarity: 'Uncommon',  emoji: '🦔', colour: '#FC8181', soul: 'Digs deep into problems. Refuses to surface until done.' },
  { id: 'mistowl',     name: 'Mistowl',      rarity: 'Uncommon',  emoji: '🦉', colour: '#76E4F7', soul: 'Sees clearly in the dark. Best at dawn and dusk.' },
  { id: 'boulderback',  name: 'Boulderback',  rarity: 'Uncommon',  emoji: '🐢', colour: '#F6E05E', soul: 'Carries the weight without complaint. Outlasts everyone.' },
  // Rare (4)
  { id: 'cinderfox',   name: 'Cinderfox',    rarity: 'Rare',      emoji: '🦊', colour: '#F6AD55', soul: 'Clever and adaptive. Thrives where others struggle.' },
  { id: 'stormkite',   name: 'Stormkite',    rarity: 'Rare',      emoji: '🦅', colour: '#667EEA', soul: 'Rides chaos. Performance peaks when stakes are highest.' },
  { id: 'prismtoad',   name: 'Prismtoad',    rarity: 'Rare',      emoji: '🐊', colour: '#38B2AC', soul: 'Patient and precise. Strikes only when certain.' },
  { id: 'velvetspine',  name: 'Velvetspine',  rarity: 'Rare',      emoji: '🦁', colour: '#ED8936', soul: 'Leads by example. Others learn faster in its presence.' },
  // Epic (2)
  { id: 'voidshark',   name: 'Voidshark',    rarity: 'Epic',      emoji: '🦈', colour: '#553C9A', soul: 'Relentless. Does not understand the concept of giving up.' },
  { id: 'auramantis',  name: 'Auramantis',   rarity: 'Epic',      emoji: '🦗', colour: '#D53F8C', soul: 'Hyper-focused. Sees the solution before the problem is stated.' },
  // Legendary (1)
  { id: 'nebulynx',    name: 'Nebulynx',     rarity: 'Legendary', emoji: '🐆', colour: '#E9D8FD', soul: 'Exists between sessions. Remembers everything. Forgets nothing.' },
]

const RARITY_WEIGHTS = { Common: 55, Uncommon: 25, Rare: 12, Epic: 6, Legendary: 2 }

// ─── Learner Stats (renamed from Claude Code's DEBUGGING/CHAOS/SNARK) ───────
const STAT_NAMES = ['FOCUS', 'CURIOSITY', 'PERSISTENCE', 'COLLABORATION', 'SPEED', 'ACCURACY']

// ─── Core Assignment (deterministic — same userId always → same species) ────
export function assignBuddy(userId) {
  const seed = hashUserId(userId)
  const rng = mulberry32(seed)

  // Build weighted pool
  const pool = []
  for (const species of SPECIES) {
    const weight = RARITY_WEIGHTS[species.rarity]
    for (let i = 0; i < weight; i++) pool.push(species)
  }

  const species = pool[Math.floor(rng() * pool.length)]

  // Generate stats (0–100)
  const stats = {}
  for (const stat of STAT_NAMES) {
    stats[stat] = Math.floor(rng() * 60) + 40 // 40–100 range
  }

  return {
    species,
    stats,
    assignedAt: new Date().toISOString(),
    level: 1,
    xp: 0,
  }
}

// ─── XP & Levelling ──────────────────────────────────────────────────────────
export function xpForLevel(level) {
  return level * 100
}

export function addXp(buddy, amount) {
  const updated = { ...buddy, xp: (buddy.xp || 0) + amount }
  while (updated.xp >= xpForLevel(updated.level)) {
    updated.xp -= xpForLevel(updated.level)
    updated.level = (updated.level || 1) + 1
  }
  return updated
}

// XP rewards
export const XP_REWARDS = {
  chat_session: 15,
  question_correct: 25,
  question_partial: 10,
  streak_day: 20,
  lesson_complete: 30,
  dream_consolidation: 50,
}

// ─── Rarity display helpers ───────────────────────────────────────────────────
export const RARITY_COLOURS = {
  Common:    'text-gray-500',
  Uncommon:  'text-green-600',
  Rare:      'text-blue-600',
  Epic:      'text-purple-600',
  Legendary: 'text-yellow-500',
}

export const RARITY_BG = {
  Common:    'bg-gray-100',
  Uncommon:  'bg-green-50',
  Rare:      'bg-blue-50',
  Epic:      'bg-purple-50',
  Legendary: 'bg-yellow-50 border border-yellow-300',
}
