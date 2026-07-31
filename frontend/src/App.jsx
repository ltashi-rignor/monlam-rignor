import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Dashboard from './pages/Dashboard'
import Essay from './pages/Essay'
import Grammar from './pages/Grammar'
import LearningPath from './pages/LearningPath'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Practice from './pages/Practice'
import ProgressPage from './pages/Progress'
import { useAuthStore } from './store/authStore'

function ProtectedOnboarding() {
  const { user, loading } = useAuthStore()
  if (loading) return <div className="empty">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.profile_complete) return <Navigate to="/dashboard" replace />
  return <Onboarding />
}

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap)

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<ProtectedOnboarding />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/learning-path" element={<LearningPath />} />
          <Route path="/grammar" element={<Grammar />} />
          <Route path="/essay" element={<Essay />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/progress" element={<ProgressPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
