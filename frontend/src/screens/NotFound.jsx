import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-20 h-20 bg-navy rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-gold text-3xl font-bold">A</span>
      </div>
      <h1 className="text-6xl font-bold text-navy mb-3">404</h1>
      <p className="text-xl font-semibold text-navy mb-2">Page not found</p>
      <p className="text-gray-500 text-center max-w-xs mb-8">
        This page doesn't exist. Let's get you back to learning.
      </p>
      <button
        onClick={() => navigate('/')}
        className="w-full max-w-sm h-14 bg-navy text-white text-lg font-semibold rounded-xl active:opacity-90 transition-opacity"
      >
        Back to home
      </button>
    </div>
  )
}
