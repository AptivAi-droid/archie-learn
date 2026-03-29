import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { MessageCircle, BarChart3, Users, LogOut } from 'lucide-react'

const tabs = [
  { path: '/chat', label: 'Chat', icon: MessageCircle },
  { path: '/progress', label: 'Progress', icon: BarChart3 },
  { path: '/parent', label: 'For Parents', icon: Users },
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
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors ${
                active ? 'text-navy' : 'text-gray-400'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
              <span className={`text-xs ${active ? 'font-semibold' : ''}`}>
                {label}
              </span>
            </button>
          )
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center gap-1 w-full h-full text-gray-400 transition-colors"
        >
          <LogOut size={22} strokeWidth={1.5} />
          <span className="text-xs">Logout</span>
        </button>
      </div>
    </nav>
  )
}
