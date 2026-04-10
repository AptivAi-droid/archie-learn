import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { X, Copy, RefreshCw } from 'lucide-react'

export default function LinkCodeModal({ onClose }) {
  const { user } = useAuth()
  const [code, setCode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchOrCreateCode()
  }, [])

  async function fetchOrCreateCode() {
    setLoading(true)
    // Check for existing valid code
    const { data: existing } = await supabase
      .from('link_codes')
      .select('code, expires_at')
      .eq('student_id', user.id)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      setCode(existing.code)
      setLoading(false)
      return
    }

    // Generate a new 6-char alphanumeric code
    const newCode = Math.random().toString(36).slice(2, 8).toUpperCase()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 2) // 48 hours

    const { data } = await supabase
      .from('link_codes')
      .insert({
        code: newCode,
        student_id: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    setCode(data?.code || newCode)
    setLoading(false)
  }

  async function copyCode() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the text manually
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white w-full max-w-lg rounded-t-2xl p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-navy font-bold text-lg">Share with Parent</h3>
          <button onClick={onClose} className="text-gray-400">
            <X size={20} />
          </button>
        </div>

        <p className="text-gray-600 text-sm mb-5">
          Give this code to your parent or guardian so they can view your progress in the Archie Parent Dashboard. The code expires in 48 hours.
        </p>

        {loading ? (
          <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        ) : (
          <div className="bg-navy rounded-2xl p-5 text-center mb-4">
            <p className="text-gold font-mono text-4xl font-bold tracking-widest">{code}</p>
            <p className="text-white/50 text-xs mt-2">Your parent link code</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={copyCode}
            className="flex-1 h-12 flex items-center justify-center gap-2 bg-gold text-navy font-semibold rounded-xl active:opacity-90 transition-opacity"
          >
            <Copy size={16} />
            {copied ? 'Copied!' : 'Copy code'}
          </button>
          <button
            onClick={fetchOrCreateCode}
            className="w-12 h-12 flex items-center justify-center border-2 border-gray-200 rounded-xl text-gray-400"
            title="Generate new code"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
