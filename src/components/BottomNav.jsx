import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { MessageCircle, BookOpen, Target, BarChart3, LogOut } from 'lucide-react'

const tabs = [
  { path: '/chat', label: 'Chat', icon: MessageCircle },
  { path: '/lessons', label: 'Lessons', icon: BookOpen },
  { path: '/practice', label: 'Practice', icon: Target },
  { path: '/progress', label: 'Progress', icon: BarChart3 },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto" style={{ height: '64px' }}>
        {tabs.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                active ? 'text-navy' : 'text-gray-400'
              }`}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className={`text-[10px] ${active ? 'font-semibold' : ''}`}>
                {label}
              </span>
            </button>
          )
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-gray-400 transition-colors"
          aria-label="Log out"
        >
          <LogOut size={20} strokeWidth={1.5} />
          <span className="text-[10px]">Out</span>
        </button>
      </div>
    </nav>
  )
}
