import { useEffect, useId, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import ErrorBoundary from './ErrorBoundary'
import { useI18n } from '../i18n/useI18n'
import { requireAuth } from '../lib/requireAuth'
import { toggleTheme, getStoredTheme } from '../lib/theme'
import { useAuthStore } from '../store/authStore'

const DRAWER_MQ = '(max-width: 1024px)'

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DRAWER_MQ).matches : false,
  )
  const [theme, setTheme] = useState(() => getStoredTheme())
  const { t, lang, setLang, isEn } = useI18n()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()
  const titleId = useId()

  const nav = [
    { to: '/', label: t.cms.nav.home, end: true },
    { to: '/about', label: t.cms.nav.about },
    { to: '/features', label: t.cms.nav.features },
    { to: '/programs', label: t.cms.nav.programs },
    { to: '/ai', label: t.cms.nav.ai },
    { to: '/blog', label: t.cms.nav.blog },
    { to: '/news', label: t.cms.nav.news },
    { to: '/faq', label: t.cms.nav.faq },
    { to: '/contact', label: t.cms.nav.contact },
  ]

  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  useEffect(() => {
    const mq = window.matchMedia(DRAWER_MQ)
    const onChange = () => {
      setIsCompact(mq.matches)
      if (!mq.matches) setMenuOpen(false)
    }
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  function onStartLearning() {
    requireAuth(navigate, user, '/dashboard')
  }

  function onLogout() {
    logout()
    setMenuOpen(false)
    navigate('/')
  }

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <div className={`cms-shell ${isEn ? 'is-en' : 'is-bo'}${menuOpen ? ' is-nav-open' : ''}`}>
      <a className="cms-skip" href="#cms-main">
        {t.cms.skip}
      </a>
      <header className="cms-header">
        <div className="cms-wrap cms-header-inner">
          <Link to="/" className="cms-brand" onClick={closeMenu}>
            <span className="cms-brand-mark">རིག་ནོར།</span>
            <span className="cms-brand-sub">Rignor</span>
          </Link>

          <nav className="cms-nav cms-nav-desktop" aria-label="Primary">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'is-active' : '')}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="cms-header-actions">
            <div className="cms-lang" role="group" aria-label="Language">
              <button
                type="button"
                className={lang === 'bo' ? 'is-active' : ''}
                onClick={() => setLang('bo')}
              >
                བོད།
              </button>
              <button
                type="button"
                className={lang === 'en' ? 'is-active' : ''}
                onClick={() => setLang('en')}
              >
                EN
              </button>
            </div>
            <button
              type="button"
              className="cms-icon-btn"
              onClick={() => setTheme(toggleTheme())}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            {user ? (
              <button type="button" className="btn btn-ghost cms-auth-desktop" onClick={onLogout}>
                {t.signOut}
              </button>
            ) : (
              <Link to="/login" className="btn btn-ghost cms-auth-desktop">
                {t.cms.nav.login}
              </Link>
            )}
            <button type="button" className="btn btn-primary cms-cta-btn" onClick={onStartLearning}>
              {t.cms.nav.start}
            </button>
            <button
              type="button"
              className="cms-burger"
              aria-expanded={menuOpen}
              aria-controls="cms-drawer"
              aria-label={menuOpen ? t.cms.nav.closeMenu : t.cms.nav.menu}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <div
        className="cms-nav-backdrop"
        hidden={!menuOpen}
        onClick={closeMenu}
        aria-hidden="true"
      />

      <aside
        id="cms-drawer"
        className={`cms-drawer ${menuOpen ? 'is-open' : ''}`}
        aria-labelledby={titleId}
        aria-hidden={!menuOpen}
        inert={isCompact && !menuOpen ? true : undefined}
      >
        <div className="cms-drawer-head">
          <p id={titleId} className="cms-brand-mark">
            རིག་ནོར།
          </p>
          <button type="button" className="cms-drawer-close" aria-label={t.cms.nav.closeMenu} onClick={closeMenu}>
            ×
          </button>
        </div>
        <nav className="cms-drawer-nav" aria-label="Primary">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'is-active' : '')}
              onClick={closeMenu}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="cms-drawer-auth">
          {user ? (
            <>
              <Link to="/dashboard" onClick={closeMenu}>
                {t.cms.nav.dashboard}
              </Link>
              <button type="button" className="cms-auth-btn" onClick={onLogout}>
                {t.signOut}
              </button>
            </>
          ) : (
            <Link to="/login" onClick={closeMenu}>
              {t.cms.nav.login}
            </Link>
          )}
          <button type="button" className="btn btn-primary" onClick={() => { closeMenu(); onStartLearning() }}>
            {t.cms.nav.start}
          </button>
        </div>
      </aside>

      <AnimatePresence mode="wait">
        <motion.main
          id="cms-main"
          key={`${location.pathname}-${lang}`}
          className="cms-main"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </motion.main>
      </AnimatePresence>

      <footer className="cms-footer">
        <div className="cms-wrap cms-footer-inner">
          <div className="cms-footer-brand">
            <p className="cms-brand-mark">རིག་ནོར།</p>
            <p className="muted">{t.cms.footer.tag}</p>
          </div>
          <div className="cms-footer-links">
            <Link to="/about">{t.cms.nav.about}</Link>
            <Link to="/programs">{t.cms.nav.programs}</Link>
            <Link to="/faq">{t.cms.nav.faq}</Link>
            <Link to="/contact">{t.cms.nav.contact}</Link>
            {user ? (
              <button type="button" className="cms-footer-auth" onClick={onLogout}>
                {t.signOut}
              </button>
            ) : (
              <Link to="/login">{t.cms.nav.login}</Link>
            )}
          </div>
          <p className="cms-footer-copy muted">© {new Date().getFullYear()} Rignor</p>
        </div>
      </footer>
    </div>
  )
}
