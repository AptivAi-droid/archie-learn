/**
 * BuddyCard — displays a learner's BUDDY companion
 * Integrates with the BUDDY system from src/lib/buddy.js
 */
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { assignBuddy, addXp, XP_REWARDS, RARITY_COLOURS, RARITY_BG, xpForLevel } from '../lib/buddy'

export default function BuddyCard({ compact = false, sessionCompleted = false }) {
  const { user } = useAuth()
  const [buddy, setBuddy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [levelUp, setLevelUp] = useState(false)

  useEffect(() => {
    if (user) loadBuddy()
  }, [user])

  // Award XP when a session completes
  useEffect(() => {
    if (sessionCompleted && buddy) awardXp(XP_REWARDS.chat_session)
  }, [sessionCompleted])

  async function loadBuddy() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('buddy_companions')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setBuddy(data.buddy_data)
      } else {
        // First time — assign deterministically from userId
        const newBuddy = assignBuddy(user.id)
        await supabase.from('buddy_companions').insert({
          user_id: user.id,
          buddy_data: newBuddy,
          created_at: new Date().toISOString(),
        })
        setBuddy(newBuddy)
      }
    } catch (err) {
      console.error('Buddy load failed:', err)
    } finally {
      setLoading(false)
    }
  }

  async function awardXp(amount) {
    if (!buddy) return
    const prevLevel = buddy.level
    const updated = addXp(buddy, amount)
    setBuddy(updated)
    if (updated.level > prevLevel) setLevelUp(true)
    await supabase
      .from('buddy_companions')
      .update({ buddy_data: updated })
      .eq('user_id', user.id)
  }

  if (loading) return <BuddySkeleton compact={compact} />
  if (!buddy) return null

  const { species, stats, level, xp } = buddy
  const xpNeeded = xpForLevel(level)
  const xpPct = Math.min(100, Math.round((xp / xpNeeded) * 100))
  const topStats = Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 3)

  if (compact) {
    return (
      <div className={`rounded-2xl p-3 flex items-center gap-3 ${RARITY_BG[species.rarity]}`}>
        <span className="text-3xl">{species.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-navy font-bold text-sm truncate">{species.name}</p>
          <p className={`text-xs font-semibold ${RARITY_COLOURS[species.rarity]}`}>{species.rarity} · Lv {level}</p>
          <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${xpPct}%` }} />
          </div>
        </div>
        {levelUp && (
          <span className="text-xs bg-gold text-navy font-bold px-2 py-1 rounded-full animate-bounce">LEVEL UP!</span>
        )}
      </div>
    )
  }

  return (
    <div className={`rounded-2xl p-5 shadow-sm ${RARITY_BG[species.rarity]}`}>
      {levelUp && (
        <div className="mb-3 bg-gold text-navy text-center text-sm font-bold py-2 rounded-xl animate-pulse">
          🎉 {species.name} reached Level {level}!
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className="text-6xl leading-none">{species.emoji}</div>
        <div>
          <h3 className="text-navy font-bold text-lg">{species.name}</h3>
          <p className={`text-sm font-bold ${RARITY_COLOURS[species.rarity]}`}>{species.rarity}</p>
          <p className="text-xs text-gray-500 mt-0.5 italic">"{species.soul}"</p>
        </div>
      </div>

      {/* Level + XP */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span className="font-bold text-navy">Level {level}</span>
          <span>{xp} / {xpNeeded} XP</span>
        </div>
        <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gold rounded-full transition-all duration-700"
            style={{ width: `${xpPct}%` }}
          />
        </div>
      </div>

      {/* Top Stats */}
      <div className="space-y-2">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Top Stats</p>
        {topStats.map(([stat, val]) => (
          <div key={stat} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-24 font-semibold">{stat}</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${val}%`, backgroundColor: species.colour }}
              />
            </div>
            <span className="text-xs text-navy font-bold w-6 text-right">{val}</span>
          </div>
        ))}
      </div>

      {/* Archie note */}
      <p className="mt-4 text-xs text-gray-400 italic text-center">
        Your companion grows as you learn. Keep the streak going.
      </p>
    </div>
  )
}

function BuddySkeleton({ compact }) {
  if (compact) return <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
  return <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
}
