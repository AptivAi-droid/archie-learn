import { useNavigate } from 'react-router-dom'

export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-navy tracking-tight">
          Archie Learn
        </h1>
        <p className="text-lg text-gold mt-2 font-medium">
          Your private school. In your pocket.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={() => navigate('/signup')}
          className="w-full h-14 bg-navy text-white text-lg font-semibold rounded-xl active:opacity-90 transition-opacity"
        >
          I'm a Student
        </button>
        <button
          onClick={() => navigate('/signup?role=parent')}
          className="w-full h-14 bg-white text-navy text-lg font-semibold rounded-xl border-2 border-navy active:opacity-90 transition-opacity"
        >
          I'm a Teacher or Parent
        </button>
      </div>

      <p className="text-sm text-gray-400 mt-12">
        Already have an account?{' '}
        <a href="/login" className="text-gold font-medium underline">
          Log in
        </a>
      </p>
    </div>
  )
}
