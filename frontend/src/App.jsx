import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import ErrorBoundary from './components/ErrorBoundary'
import PublicLayout from './components/PublicLayout'
import { useAuthStore } from './store/authStore'
import { useI18n } from './i18n/useI18n'

const CmsHome = lazy(() => import('./pages/cms/CmsHome'))
const CmsAbout = lazy(() => import('./pages/cms/CmsAbout'))
const CmsFeatures = lazy(() => import('./pages/cms/CmsFeatures'))
const CmsPrograms = lazy(() => import('./pages/cms/CmsPrograms'))
const CmsProgramDetail = lazy(() => import('./pages/cms/CmsProgramDetail'))
const CmsAi = lazy(() => import('./pages/cms/CmsAi'))
const CmsBlog = lazy(() => import('./pages/cms/CmsBlog'))
const CmsBlogPost = lazy(() => import('./pages/cms/CmsBlogPost'))
const CmsNews = lazy(() => import('./pages/cms/CmsNews'))
const CmsNewsPost = lazy(() => import('./pages/cms/CmsNewsPost'))
const CmsFaq = lazy(() => import('./pages/cms/CmsFaq'))
const CmsContact = lazy(() => import('./pages/cms/CmsContact'))
const Login = lazy(() => import('./pages/Login'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const LearningPath = lazy(() => import('./pages/LearningPath'))
const Alphabet = lazy(() => import('./pages/Alphabet'))
const Flashcards = lazy(() => import('./pages/Flashcards'))
const Lessons = lazy(() => import('./pages/Lessons'))
const LessonDetail = lazy(() => import('./pages/LessonDetail'))
const Handwriting = lazy(() => import('./pages/Handwriting'))
const LetterParty = lazy(() => import('./pages/LetterParty'))
const Tutor = lazy(() => import('./pages/Tutor'))
const Grammar = lazy(() => import('./pages/Grammar'))
const Story = lazy(() => import('./pages/Story'))
const Speak = lazy(() => import('./pages/Speak'))
const Practice = lazy(() => import('./pages/Practice'))
const ProgressPage = lazy(() => import('./pages/Progress'))

function PageFallback() {
  const { t } = useI18n()
  return <div className="empty">{t.loading}</div>
}

function ProtectedOnboarding() {
  const { t } = useI18n()
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  if (loading && !user) return <div className="empty">{t.loading}</div>
  if (!user) return <Navigate to="/login" replace />
  return <Onboarding />
}

function NotFound() {
  return (
    <div className="panel empty" style={{ margin: '2rem auto', maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>404</h2>
      <p className="muted">Page not found.</p>
      <a className="btn btn-primary" href="/">
        Home
      </a>
    </div>
  )
}

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap)

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
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
              <Route path="/story" element={<Story />} />
              <Route path="/speak" element={<Speak />} />
              <Route path="/essay" element={<Navigate to="/story" replace />} />
              <Route path="/practice" element={<Practice />} />
              <Route path="/progress" element={<ProgressPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
