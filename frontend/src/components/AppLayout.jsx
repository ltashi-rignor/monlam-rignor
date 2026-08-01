import { useEffect, useId, useState } from 'react'
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary'
import { useI18n } from '../i18n/useI18n'
import { useAuthStore } from '../store/authStore'

const DRAWER_MQ = '(max-width: 1024px)'

export default function AppLayout() {
  const { t, lang, setLang, isEn } = useI18n()
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DRAWER_MQ).matches : false,
  )
  const titleId = useId()

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
    { to: '/story', label: t.nav.story || 'སྒྲུང་།' },
    { to: '/practice', label: t.nav.practice },
    { to: '/progress', label: t.nav.progress },
    { to: '/onboarding', label: t.nav.profile },
  ]

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!navOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [navOpen])

  useEffect(() => {
    const mq = window.matchMedia(DRAWER_MQ)
    const onChange = () => {
      setIsCompact(mq.matches)
      if (!mq.matches) setNavOpen(false)
    }
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  if (loading && !user) return <div className="empty tibetan">{t.loading}</div>
  if (!user) {
    const next = `${location.pathname}${location.search || ''}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  if (!user.profile_complete) return <Navigate to="/onboarding" replace />

  function closeNav() {
    setNavOpen(false)
  }

  return (
    <div className={`app-shell ${isEn ? 'is-en' : 'tibetan'}${navOpen ? ' is-nav-open' : ''}`}>
      <header className="app-topbar">
        <button
          type="button"
          className="app-burger"
          aria-expanded={navOpen}
          aria-controls="app-sidebar"
          aria-label={navOpen ? t.nav.closeMenu : t.nav.menu}
          onClick={() => setNavOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="app-topbar-brand">
          <span className="brand">{t.brand}</span>
        </div>
        <div className="cms-lang app-topbar-lang" role="group" aria-label="Language">
          <button type="button" className={lang === 'bo' ? 'is-active' : ''} onClick={() => setLang('bo')}>
            བོད།
          </button>
          <button type="button" className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>
            EN
          </button>
        </div>
      </header>

      <div
        className="app-nav-backdrop"
        hidden={!navOpen}
        onClick={closeNav}
        aria-hidden="true"
      />

      <aside
        id="app-sidebar"
        className="sidebar"
        aria-labelledby={titleId}
        inert={isCompact && !navOpen ? true : undefined}
      >
        <div className="sidebar-drawer-head">
          <p id={titleId} className="brand">
            {t.brand}
          </p>
          <button
            type="button"
            className="app-drawer-close"
            aria-label={t.nav.closeMenu}
            onClick={closeNav}
          >
            ×
          </button>
        </div>
        <div className="brand-block">
          <p className="brand sidebar-brand-desktop">{t.brand}</p>
          <p>{t.brandSub}</p>
          <NavLink to="/" className="sidebar-home-link" onClick={closeNav}>
            {t.cms.nav.home}
          </NavLink>
        </div>
        <nav className="nav-list" aria-label={t.nav.menu}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
              onClick={closeNav}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="cms-lang sidebar-lang" role="group" aria-label="Language">
            <button type="button" className={lang === 'bo' ? 'is-active' : ''} onClick={() => setLang('bo')}>
              བོད།
            </button>
            <button type="button" className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>
              EN
            </button>
          </div>
          <div className="sidebar-user">
            {user.username ? <strong dir="ltr">@{user.username}</strong> : null}
            <span>{user.email}</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost sidebar-logout"
            onClick={() => {
              closeNav()
              logout()
            }}
          >
            {t.signOut}
          </button>
        </div>
      </aside>

      <main className="main">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
