import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function MeetArchie() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const name = profile?.first_name || 'there'
  const subject = profile?.primary_subject || 'your subject'

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-navy rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-gold text-3xl font-bold">A</span>
        </div>
        <h1 className="text-2xl font-bold text-navy">Meet Archie</h1>
      </div>

      <div className="w-full max-w-sm">
        <div className="bg-navy rounded-2xl rounded-tl-sm p-5 mb-10">
          <p className="text-white text-base leading-relaxed">
            Hi {name}! I'm Archie — your personal study partner.
            I won't just give you answers. I'll help you actually
            understand. Ready to start with {subject}?
          </p>
        </div>

        <button
          onClick={() => navigate('/chat')}
          className="w-full h-14 bg-gold text-navy text-lg font-bold rounded-xl active:opacity-90 transition-opacity"
        >
          Let's do this
        </button>
      </div>
    </div>
  )
}
