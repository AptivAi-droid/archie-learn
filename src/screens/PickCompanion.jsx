import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { SPECIES, RARITY_COLOURS, RARITY_BG } from '../lib/buddy'

// Mulberry32 — small PRNG used to give each user the same 8 picks per session
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickDeterministicChoices(userId, count = 8) {
  // Hash userId for a seed, then shuffle species and take the first N
  let h = 0
  for (let i = 0; i < userId.length; i++) {
    h = (Math.imul(31, h) + userId.charCodeAt(i)) | 0
  }
  const rng = mulberry32(Math.abs(h))
  const shuffled = [...SPECIES].sort(() => rng() - 0.5)
  // Make sure at least one Rare or Epic creature is in the choices to make it feel special
  const rareOrBetter = SPECIES.filter((s) => ['Rare', 'Epic', 'Legendary'].includes(s.rarity))
  if (!shuffled.slice(0, count).some((s) => ['Rare', 'Epic', 'Legendary'].includes(s.rarity))) {
    const rareChoice = rareOrBetter[Math.floor(rng() * rareOrBetter.length)]
    shuffled.splice(count - 1, 1, rareChoice)
  }
  return shuffled.slice(0, count)
}

const STAT_NAMES = ['FOCUS', 'CURIOSITY', 'PERSISTENCE', 'COLLABORATION', 'SPEED', 'ACCURACY']

function generateStats(seed) {
  const rng = mulberry32(seed)
  const stats = {}
  for (const stat of STAT_NAMES) {
    stats[stat] = Math.floor(rng() * 60) + 40 // 40-100
  }
  return stats
}

export default function PickCompanion() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pickedId, setPickedId] = useState(null)
  const [nickname, setNickname] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 8 deterministic choices for this user
  const choices = useMemo(() => pickDeterministicChoices(user?.id || ''), [user?.id])
  const picked = choices.find((c) => c.id === pickedId)

  async function handleConfirm() {
    if (!picked) return
    setSaving(true)
    setError('')
    try {
      // Seed stats based on user + species id (so same pick = same stats)
      const seedStr = (user.id + picked.id)
      let h = 0
      for (let i = 0; i < seedStr.length; i++) h = (Math.imul(31, h) + seedStr.charCodeAt(i)) | 0
      const stats = generateStats(Math.abs(h))

      const buddy_data = {
        species: picked,
        nickname: nickname.trim() || picked.name,
        stats,
        level: 1,
        xp: 0,
        assignedAt: new Date().toISOString(),
      }

      const { error: err } = await supabase
        .from('buddy_companions')
        .upsert({ user_id: user.id, buddy_data }, { onConflict: 'user_id' })
      if (err) throw err
      navigate('/chat')
    } catch (e) {
      setError(e.message || 'Could not save your companion. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-white px-6 py-10 flex flex-col items-center">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-navy">Pick your companion</h1>
        <p className="text-gray-500 mt-2 max-w-md">
          They'll grow with you — earn XP each time you study, chat with Archie, or answer practice questions.
        </p>
      </div>

      <div className="w-full max-w-3xl grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {choices.map((c) => {
          const selected = pickedId === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setPickedId(c.id)
                setNickname((prev) => prev || c.name)
              }}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${
                selected
                  ? 'border-navy bg-navy shadow-lg scale-[1.02]'
                  : 'border-gray-200 bg-white hover:border-gold'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-3xl leading-none">{c.emoji}</span>
                <span
                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                    selected
                      ? 'bg-gold text-navy'
                      : c.rarity === 'Legendary'
                      ? 'bg-yellow-100 text-yellow-700'
                      : c.rarity === 'Epic'
                      ? 'bg-purple-100 text-purple-700'
                      : c.rarity === 'Rare'
                      ? 'bg-blue-100 text-blue-700'
                      : c.rarity === 'Uncommon'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {c.rarity}
                </span>
              </div>
              <h3 className={`font-bold text-base ${selected ? 'text-white' : 'text-navy'}`}>{c.name}</h3>
              <p className={`text-xs mt-1 italic leading-snug ${selected ? 'text-white/70' : 'text-gray-500'}`}>
                "{c.soul}"
              </p>
            </button>
          )
        })}
      </div>

      {picked && (
        <div className="w-full max-w-md mb-4">
          <label className="block text-sm font-medium text-navy mb-1">Name your companion</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 24))}
            maxLength={24}
            placeholder={picked.name}
            className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base focus:border-navy focus:outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">Keep "{picked.name}" or rename them.</p>
        </div>
      )}

      {error && (
        <div className="w-full max-w-md bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>
      )}

      <div className="w-full max-w-md sticky bottom-4 mt-4">
        <button
          onClick={handleConfirm}
          disabled={!picked || saving}
          className="w-full h-14 bg-gold text-navy text-lg font-bold rounded-xl active:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {saving ? 'Saving…' : picked ? `Continue with ${nickname || picked.name}` : 'Pick a companion to continue'}
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">
          You can change your companion later in your profile.
        </p>
      </div>
    </div>
  )
}
