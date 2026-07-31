import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { bo } from '../i18n/bo'
import { useAuthStore } from '../store/authStore'

const links = [
  { to: '/dashboard', label: bo.nav.dashboard },
  { to: '/learning-path', label: bo.nav.learningPath },
  { to: '/alphabet', label: bo.nav.alphabet },
  { to: '/flashcards', label: bo.nav.flashcards },
  { to: '/lessons', label: bo.nav.lessons },
  { to: '/handwriting', label: bo.nav.handwriting },
  { to: '/tutor', label: bo.nav.tutor },
  { to: '/grammar', label: bo.nav.grammar },
  { to: '/essay', label: bo.nav.essay },
  { to: '/practice', label: bo.nav.practice },
  { to: '/progress', label: bo.nav.progress },
  { to: '/onboarding', label: bo.nav.profile },
]

export default function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const logout = useAuthStore((s) => s.logout)

  // Keep shell visible once we have a user — avoid full blank flash on remounts
  if (loading && !user) return <div className="empty tibetan">{bo.loading}</div>
  if (!user) return <Navigate to="/login" replace />
  if (!user.profile_complete) return <Navigate to="/onboarding" replace />

  return (
    <div className="app-shell tibetan">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand">{bo.brand}</p>
          <p>{bo.brandSub}</p>
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
            {bo.signOut}
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
