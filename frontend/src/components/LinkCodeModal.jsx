import { useState, useEffect, useRef } from 'react'
import { linkCodes, friendlyError } from '../lib/api'
import { X, Copy, RefreshCw } from 'lucide-react'

export default function LinkCodeModal({ onClose }) {
  const [code, setCode] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // Each POST replaces the previous code, so only request once on mount (StrictMode re-runs effects)
  const requestedRef = useRef(false)
  useEffect(() => {
    if (requestedRef.current) return
    requestedRef.current = true
    fetchOrCreateCode()
  }, [])

  // POST /link-codes — the server issues a fresh 6-char code (24 h) and retires any unused one
  async function fetchOrCreateCode() {
    setLoading(true)
    setError('')
    try {
      const data = await linkCodes.create()
      setCode(data?.code || null)
      if (!data?.code) setError("Couldn't create a code right now. Tap refresh to try again.")
    } catch (err) {
      // Never show a code that was not saved — the parent would be unable to redeem it
      setCode(null)
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
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
          <button onClick={onClose} className="text-gray-400" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <p className="text-gray-600 text-sm mb-5">
          Give this code to your parent or guardian so they can view your progress in the Archie Parent Dashboard. The code expires in 24 hours.
        </p>

        {loading ? (
          <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        ) : !code ? (
          <div className="bg-red-50 text-red-600 text-sm p-4 rounded-2xl text-center mb-4" role="alert">
            {error || "Couldn't create a code right now. Tap refresh to try again."}
          </div>
        ) : (
          <div className="bg-navy rounded-2xl p-5 text-center mb-4">
            <p className="text-gold font-mono text-4xl font-bold tracking-widest">{code}</p>
            <p className="text-white/50 text-xs mt-2">Your parent link code</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={copyCode}
            disabled={!code || loading}
            className="flex-1 h-12 flex items-center justify-center gap-2 bg-gold text-navy font-semibold rounded-xl active:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Copy size={16} />
            {copied ? 'Copied!' : 'Copy code'}
          </button>
          <button
            onClick={fetchOrCreateCode}
            disabled={loading}
            aria-label="Generate new code"
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
