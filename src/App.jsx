import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Welcome from './screens/Welcome'
import Signup from './screens/Signup'
import Login from './screens/Login'
import ProfileSetup from './screens/ProfileSetup'
import MeetArchie from './screens/MeetArchie'
import Tutor from './screens/Tutor'
import Progress from './screens/Progress'
import ParentView from './screens/ParentView'
import AdminDashboard from './screens/AdminDashboard'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 bg-navy rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-gold font-bold">A</span>
        </div>
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/" replace />
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />
  if (!profile?.first_name) return <Navigate to="/setup" replace />

  return children
}

function AuthRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return null
  if (user && profile?.role === 'admin') return <Navigate to="/admin" replace />
  if (user && profile?.first_name) return <Navigate to="/chat" replace />

  return children
}

function SetupRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />

  return children
}

function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (profile?.role !== 'admin') return <Navigate to="/" replace />

  return children
}

function MeetArchieRoute({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  const fromSetup = location.state?.fromSetup

  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  if (!profile?.first_name) return <Navigate to="/setup" replace />
  if (!fromSetup) return <Navigate to="/chat" replace />

  return children
}

export default function App() {
  return (
    <BrowserRouter basename="/archie-learn">
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<AuthRoute><Welcome /></AuthRoute>} />
          <Route path="/signup" element={<AuthRoute><Signup /></AuthRoute>} />
          <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />

          {/* Setup routes */}
          <Route path="/setup" element={<SetupRoute><ProfileSetup /></SetupRoute>} />
          <Route path="/meet-archie" element={<MeetArchieRoute><MeetArchie /></MeetArchieRoute>} />

          {/* Protected routes with bottom nav */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/chat" element={<Tutor />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/parent" element={<ParentView />} />
          </Route>

          {/* Admin route */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
