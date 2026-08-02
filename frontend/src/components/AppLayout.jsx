import { useEffect, useId, useMemo, useState } from 'react'
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import ErrorBoundary from './ErrorBoundary'
import { useI18n } from '../i18n/useI18n'
import { getStoredTheme, toggleTheme } from '../lib/theme'
import { useAuthStore } from '../store/authStore'

const DRAWER_MQ = '(max-width: 1024px)'

const EMPTY_OPEN = {
  home: false,
  learn: false,
  practice: false,
  progress: false,
  website: false,
  account: false,
}

function pathMatchesLink(pathname, link) {
  if (link.end || link.to === '/') return pathname === link.to
  return pathname === link.to || pathname.startsWith(`${link.to}/`)
}

function pathInGroup(pathname, links) {
  return links.some((l) => pathMatchesLink(pathname, l))
}

function defaultOpenGroups() {
  return { ...EMPTY_OPEN }
}

export default function AppLayout() {
  const { t, lang, setLang, isEn } = useI18n()
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const [theme, setTheme] = useState(() => getStoredTheme())
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DRAWER_MQ).matches : false,
  )
  const titleId = useId()

  function onToggleTheme() {
    setTheme(toggleTheme())
  }

  const groups = useMemo(
    () => [
      {
        id: 'home',
        label: t.nav.groupHome,
        links: [
          { to: '/dashboard', label: t.nav.dashboard },
          { to: '/practice', label: t.nav.todayPractice },
          { to: '/learning-path', label: t.nav.learningPath },
          { to: '/tutor', label: t.nav.tutor },
        ],
      },
      {
        id: 'learn',
        label: t.nav.groupLearn,
        links: [
          { to: '/alphabet', label: t.nav.alphabet },
          { to: '/lessons', label: t.nav.lessons },
          { to: '/grammar', label: t.nav.grammar },
          { to: '/story', label: t.nav.story },
        ],
      },
      {
        id: 'practice',
        label: t.nav.groupPractice,
        links: [
          { to: '/handwriting', label: t.nav.handwriting },
          { to: '/letter-party', label: t.nav.letterParty },
          { to: '/flashcards', label: t.nav.flashcards },
          { to: '/practice', label: t.nav.practice },
        ],
      },
      {
        id: 'progress',
        label: t.nav.groupProgress,
        links: [{ to: '/progress', label: t.nav.learningProgress }],
      },
      {
        id: 'website',
        label: t.nav.groupWebsite,
        links: [
          { to: '/', label: t.cms.nav.home, end: true },
          { to: '/about', label: t.cms.nav.about },
          { to: '/programs', label: t.nav.courses },
          { to: '/features', label: t.cms.nav.features },
          { to: '/blog', label: t.cms.nav.blog },
          { to: '/news', label: t.cms.nav.news },
          { to: '/faq', label: t.cms.nav.faq },
          { to: '/contact', label: t.cms.nav.contact },
        ],
      },
      {
        id: 'account',
        label: t.nav.groupAccount,
        links: [{ to: '/onboarding', label: t.nav.profile }],
        showLogout: true,
      },
    ],
    [t],
  )

  const [openGroups, setOpenGroups] = useState(defaultOpenGroups)

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
      const compact = mq.matches
      setIsCompact(compact)
      if (!compact) setNavOpen(false)
      setOpenGroups(defaultOpenGroups())
    }
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

  function toggleGroup(id) {
    setOpenGroups((prev) => {
      const willOpen = !prev[id]
      if (!willOpen) return { ...prev, [id]: false }
      return { ...EMPTY_OPEN, [id]: true }
    })
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
          <BrandLogo size="sm" />
        </div>
        <div className="cms-lang app-topbar-lang" role="group" aria-label="Language">
          <button type="button" className={lang === 'bo' ? 'is-active' : ''} onClick={() => setLang('bo')}>
            བོད།
          </button>
          <button type="button" className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>
            EN
          </button>
        </div>
        <button
          type="button"
          className="cms-icon-btn app-topbar-theme"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
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
          <div id={titleId} className="sidebar-drawer-brand">
            <BrandLogo size="sm" />
          </div>
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
          <NavLink to="/dashboard" className="brand-logo-link sidebar-brand-desktop" onClick={closeNav}>
            <BrandLogo size="md" />
          </NavLink>
          <p className="brand-tagline">{t.brandSub}</p>
        </div>

        <nav className="nav-list" aria-label={t.nav.menu}>
          <div className="nav-groups">
            {groups.map((g) => {
              const open = Boolean(openGroups[g.id])
              const activeHere = pathInGroup(location.pathname, g.links)
              const panelId = `nav-group-${g.id}`
              return (
                <div
                  key={g.id}
                  className={`nav-group${open ? ' is-open' : ''}${activeHere ? ' has-active' : ''}`}
                >
                  <button
                    type="button"
                    className="nav-group-toggle"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => toggleGroup(g.id)}
                  >
                    <span className="nav-group-title">{g.label}</span>
                    <span className="nav-group-chevron" aria-hidden="true" />
                  </button>
                  <div
                    id={panelId}
                    className="nav-group-panel"
                    role="region"
                    aria-label={g.label}
                  >
                    <div className="nav-group-links">
                      {g.links.map((l) => (
                        <NavLink
                          key={`${g.id}:${l.to}`}
                          to={l.to}
                          end={Boolean(l.end)}
                          className={({ isActive }) => (isActive ? 'active' : '')}
                          onClick={closeNav}
                        >
                          {l.label}
                        </NavLink>
                      ))}
                      {g.showLogout ? (
                        <button
                          type="button"
                          className="nav-group-action"
                          onClick={() => {
                            closeNav()
                            logout()
                          }}
                        >
                          {t.signOut}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-tools">
            <div className="cms-lang sidebar-lang" role="group" aria-label="Language">
              <button type="button" className={lang === 'bo' ? 'is-active' : ''} onClick={() => setLang('bo')}>
                བོད།
              </button>
              <button type="button" className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>
                EN
              </button>
            </div>
            <button
              type="button"
              className="sidebar-theme-btn"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
          </div>
          <div className="sidebar-user">
            {user.username ? <strong dir="ltr">@{user.username}</strong> : null}
            <span>{user.email}</span>
          </div>
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
