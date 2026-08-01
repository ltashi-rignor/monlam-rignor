import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import PublicLayout from './components/PublicLayout'
import Alphabet from './pages/Alphabet'
import Dashboard from './pages/Dashboard'
import Essay from './pages/Essay'
import Flashcards from './pages/Flashcards'
import Grammar from './pages/Grammar'
import Handwriting from './pages/Handwriting'
import LetterParty from './pages/LetterParty'
import LearningPath from './pages/LearningPath'
import LessonDetail from './pages/LessonDetail'
import Lessons from './pages/Lessons'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Practice from './pages/Practice'
import ProgressPage from './pages/Progress'
import Tutor from './pages/Tutor'
import CmsAbout from './pages/cms/CmsAbout'
import CmsAi from './pages/cms/CmsAi'
import CmsBlog from './pages/cms/CmsBlog'
import CmsBlogPost from './pages/cms/CmsBlogPost'
import CmsContact from './pages/cms/CmsContact'
import CmsFaq from './pages/cms/CmsFaq'
import CmsFeatures from './pages/cms/CmsFeatures'
import CmsHome from './pages/cms/CmsHome'
import CmsNews from './pages/cms/CmsNews'
import CmsNewsPost from './pages/cms/CmsNewsPost'
import CmsProgramDetail from './pages/cms/CmsProgramDetail'
import CmsPrograms from './pages/cms/CmsPrograms'
import { useAuthStore } from './store/authStore'

function ProtectedOnboarding() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  if (loading && !user) return <div className="empty">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
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
        <Route element={<PublicLayout />}>
          <Route path="/" element={<CmsHome />} />
          <Route path="/about" element={<CmsAbout />} />
          <Route path="/features" element={<CmsFeatures />} />
          <Route path="/programs" element={<CmsPrograms />} />
          <Route path="/programs/:slug" element={<CmsProgramDetail />} />
          <Route path="/ai" element={<CmsAi />} />
          <Route path="/blog" element={<CmsBlog />} />
          <Route path="/blog/:slug" element={<CmsBlogPost />} />
          <Route path="/news" element={<CmsNews />} />
          <Route path="/news/:slug" element={<CmsNewsPost />} />
          <Route path="/faq" element={<CmsFaq />} />
          <Route path="/contact" element={<CmsContact />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<ProtectedOnboarding />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/learning-path" element={<LearningPath />} />
          <Route path="/alphabet" element={<Alphabet />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/lessons" element={<Lessons />} />
          <Route path="/lessons/:id" element={<LessonDetail />} />
          <Route path="/handwriting" element={<Handwriting />} />
          <Route path="/letter-party" element={<LetterParty />} />
          <Route path="/tutor" element={<Tutor />} />
          <Route path="/grammar" element={<Grammar />} />
          <Route path="/essay" element={<Essay />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/progress" element={<ProgressPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
