import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'
import { useAuthStore } from '../store/authStore'

export default function AppLayout() {
  const { t, lang, setLang, isEn } = useI18n()
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()

  const links = [
    { to: '/dashboard', label: t.nav.dashboard },
    { to: '/learning-path', label: t.nav.learningPath },
    { to: '/alphabet', label: t.nav.alphabet },
    { to: '/flashcards', label: t.nav.flashcards },
    { to: '/lessons', label: t.nav.lessons },
    { to: '/handwriting', label: t.nav.handwriting },
    { to: '/letter-party', label: t.nav.letterParty },
    { to: '/tutor', label: t.nav.tutor },
    { to: '/grammar', label: t.nav.grammar },
    { to: '/essay', label: t.nav.essay },
    { to: '/practice', label: t.nav.practice },
    { to: '/progress', label: t.nav.progress },
    { to: '/onboarding', label: t.nav.profile },
  ]

  if (loading && !user) return <div className="empty tibetan">{t.loading}</div>
  if (!user) {
    const next = `${location.pathname}${location.search || ''}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  if (!user.profile_complete) return <Navigate to="/onboarding" replace />

  return (
    <div className={`app-shell ${isEn ? 'is-en' : 'tibetan'}`}>
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand">{t.brand}</p>
          <p>{t.brandSub}</p>
          <NavLink to="/" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
            {t.cms.nav.home}
          </NavLink>
          <div className="cms-lang sidebar-lang" role="group" aria-label="Language">
            <button type="button" className={lang === 'bo' ? 'is-active' : ''} onClick={() => setLang('bo')}>
              བོད།
            </button>
            <button type="button" className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>
              EN
            </button>
          </div>
        </div>
        <nav className="nav-list">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{ marginBottom: 12, opacity: 0.85, fontSize: '0.92rem' }}>{user.email}</div>
          <button
            className="btn btn-ghost"
            style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.25)' }}
            onClick={logout}
          >
            {t.signOut}
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
