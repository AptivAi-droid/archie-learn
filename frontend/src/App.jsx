import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth, homePathFor } from './contexts/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'

// Lazy-loaded screens — each becomes its own chunk so the initial download stays
// small on low-end Android devices and slow / metered South African connections.
const Welcome = lazy(() => import('./screens/Welcome'))
const Signup = lazy(() => import('./screens/Signup'))
const Apply = lazy(() => import('./screens/Apply'))
const Login = lazy(() => import('./screens/Login'))
const ForgotPassword = lazy(() => import('./screens/ForgotPassword'))
const ResetPassword = lazy(() => import('./screens/ResetPassword'))
const ProfileSetup = lazy(() => import('./screens/ProfileSetup'))
const MeetArchie = lazy(() => import('./screens/MeetArchie'))
const PickCompanion = lazy(() => import('./screens/PickCompanion'))
const Tutor = lazy(() => import('./screens/Tutor'))
const Lessons = lazy(() => import('./screens/Lessons'))
const Practice = lazy(() => import('./screens/Practice'))
const Progress = lazy(() => import('./screens/Progress'))
const ParentView = lazy(() => import('./screens/ParentView'))
const TeacherDashboard = lazy(() => import('./screens/TeacherDashboard'))
const AdminDashboard = lazy(() => import('./screens/AdminDashboard'))
const AdminLogin = lazy(() => import('./screens/AdminLogin'))
const NotFound = lazy(() => import('./screens/NotFound'))

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

// Shown when we have a session but couldn't load the profile (network / timeout).
// Without this, a missing profile would be misread as "needs setup".
function ProfileErrorScreen() {
  const { fetchProfile } = useAuth()
  const [retrying, setRetrying] = useState(false)

  async function handleRetry() {
    setRetrying(true)
    try {
      await fetchProfile()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-12 h-12 bg-navy rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-gold font-bold text-lg">A</span>
        </div>
        <h1 className="text-xl font-bold text-navy">Can't reach Archie right now</h1>
        <p className="text-gray-500 text-sm mt-2">
          Check your internet connection and try again.
        </p>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="mt-6 w-full h-12 bg-navy text-white font-semibold rounded-xl active:opacity-90 transition-opacity disabled:opacity-50"
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, profile, profileError, loading, sessionExpired } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to={sessionExpired ? '/login' : '/'} replace />
  if (profileError && !profile) return <ProfileErrorScreen />
  if (profile?.role !== 'student' || !profile?.setup_complete) {
    return <Navigate to={homePathFor(profile)} replace />
  }

  return children
}

function AuthRoute({ children }) {
  const { user, profile, profileError, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return children
  if (profileError && !profile) return <ProfileErrorScreen />

  return <Navigate to={homePathFor(profile)} replace />
}

function SetupRoute({ children }) {
  const { user, profile, profileError, loading, sessionExpired } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to={sessionExpired ? '/login' : '/'} replace />
  if (profileError && !profile) return <ProfileErrorScreen />
  // Admins never need setup; completed profiles go straight into the app.
  if (profile?.role === 'admin' || profile?.setup_complete) {
    return <Navigate to={homePathFor(profile)} replace />
  }

  return children
}

function AdminRoute({ children }) {
  const { user, profile, profileError, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/admin/login" replace />
  if (profileError && !profile) return <ProfileErrorScreen />
  if (profile?.role !== 'admin') return <Navigate to="/" replace />

  return children
}

// Teacher / parent dashboards: right role AND a completed profile (first_name)
function RoleRoute({ role, children }) {
  const { user, profile, profileError, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (profileError && !profile) return <ProfileErrorScreen />
  if (profile?.role !== role) return <Navigate to="/" replace />
  if (!profile?.setup_complete) return <Navigate to="/setup" replace />

  return children
}

function MeetArchieRoute({ children }) {
  const { user, profile, profileError, loading } = useAuth()
  const location = useLocation()
  const fromSetup = location.state?.fromSetup

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/" replace />
  if (profileError && !profile) return <ProfileErrorScreen />
  if (!profile?.setup_complete) return <Navigate to="/setup" replace />
  if (!fromSetup) return <Navigate to="/chat" replace />

  return children
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ErrorBoundary>
        <AuthProvider>
          <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<AuthRoute><Welcome /></AuthRoute>} />
            <Route path="/signup" element={<AuthRoute><Signup /></AuthRoute>} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Setup routes */}
            <Route path="/setup" element={<SetupRoute><ProfileSetup /></SetupRoute>} />
            <Route path="/meet-archie" element={<MeetArchieRoute><MeetArchie /></MeetArchieRoute>} />
            <Route path="/pick-companion" element={<ProtectedRoute><PickCompanion /></ProtectedRoute>} />

            {/* Student routes with bottom nav */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/chat" element={<ErrorBoundary><Tutor /></ErrorBoundary>} />
              <Route path="/lessons" element={<ErrorBoundary><Lessons /></ErrorBoundary>} />
              <Route path="/practice" element={<ErrorBoundary><Practice /></ErrorBoundary>} />
              <Route path="/progress" element={<ErrorBoundary><Progress /></ErrorBoundary>} />
            </Route>

            {/* Role-specific routes */}
            <Route path="/parent" element={<RoleRoute role="parent"><ErrorBoundary><ParentView /></ErrorBoundary></RoleRoute>} />
            <Route path="/teacher" element={<RoleRoute role="teacher"><ErrorBoundary><TeacherDashboard /></ErrorBoundary></RoleRoute>} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminRoute><ErrorBoundary><AdminDashboard /></ErrorBoundary></AdminRoute>} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
