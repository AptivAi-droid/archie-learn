import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import Welcome from './screens/Welcome'
import Signup from './screens/Signup'
import Login from './screens/Login'
import ProfileSetup from './screens/ProfileSetup'
import MeetArchie from './screens/MeetArchie'
import Tutor from './screens/Tutor'
import Lessons from './screens/Lessons'
import Practice from './screens/Practice'
import Progress from './screens/Progress'
import ParentView from './screens/ParentView'
import TeacherDashboard from './screens/TeacherDashboard'
import AdminDashboard from './screens/AdminDashboard'
import NotFound from './screens/NotFound'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 bg-navy rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-gold font-bold text-lg">A</span>
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
  if (profile?.role === 'teacher') return <Navigate to="/teacher" replace />
  if (profile?.role === 'parent') return <Navigate to="/parent" replace />
  if (!profile?.first_name) return <Navigate to="/setup" replace />

  return children
}

function AuthRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return null
  if (!user) return children

  if (profile?.role === 'admin') return <Navigate to="/admin" replace />
  if (profile?.role === 'teacher') return <Navigate to="/teacher" replace />
  if (profile?.role === 'parent') return <Navigate to="/parent" replace />
  if (profile?.first_name) return <Navigate to="/chat" replace />

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

function TeacherRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (profile?.role !== 'teacher') return <Navigate to="/" replace />

  return children
}

function ParentRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (profile?.role !== 'parent') return <Navigate to="/" replace />

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
      <ErrorBoundary>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<AuthRoute><Welcome /></AuthRoute>} />
            <Route path="/signup" element={<AuthRoute><Signup /></AuthRoute>} />
            <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />

            {/* Setup routes */}
            <Route path="/setup" element={<SetupRoute><ProfileSetup /></SetupRoute>} />
            <Route path="/meet-archie" element={<MeetArchieRoute><MeetArchie /></MeetArchieRoute>} />

            {/* Student routes with bottom nav */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/chat" element={<ErrorBoundary><Tutor /></ErrorBoundary>} />
              <Route path="/lessons" element={<ErrorBoundary><Lessons /></ErrorBoundary>} />
              <Route path="/practice" element={<ErrorBoundary><Practice /></ErrorBoundary>} />
              <Route path="/progress" element={<ErrorBoundary><Progress /></ErrorBoundary>} />
            </Route>

            {/* Role-specific routes */}
            <Route path="/parent" element={<ParentRoute><ErrorBoundary><ParentView /></ErrorBoundary></ParentRoute>} />
            <Route path="/teacher" element={<TeacherRoute><ErrorBoundary><TeacherDashboard /></ErrorBoundary></TeacherRoute>} />
            <Route path="/admin" element={<AdminRoute><ErrorBoundary><AdminDashboard /></ErrorBoundary></AdminRoute>} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
