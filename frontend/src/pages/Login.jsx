import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useI18n } from '../i18n/useI18n'
import { safeNextPath } from '../lib/requireAuth'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const { t, lang, setLang, isEn } = useI18n()
  const user = useAuthStore((s) => s.user)
  const [mode, setMode] = useState('login') // login | signup-email | signup-otp | signup-account
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const loginWithPassword = useAuthStore((s) => s.loginWithPassword)
  const registerAccount = useAuthStore((s) => s.registerAccount)
  const navigate = useNavigate()
  const [params] = useSearchParams()

  useEffect(() => {
    if (!user) return
    if (!user.profile_complete) {
      navigate('/onboarding', { replace: true })
      return
    }
    navigate(safeNextPath(params.get('next'), '/dashboard'), { replace: true })
  }, [user, navigate, params])

  function goAfterAuth(res) {
    if (!res.profile_complete) {
      navigate('/onboarding')
      return
    }
    navigate(safeNextPath(params.get('next'), '/dashboard'))
  }

  function switchMode(next) {
    setMode(next)
    setError('')
    setInfo('')
    setPassword('')
    setPasswordConfirm('')
    setCode('')
  }

  async function onLogin(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await loginWithPassword(identifier, password)
      goAfterAuth(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function sendOtp(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.requestOtp(email)
      setInfo(t.login.otpSent)
      setMode('signup-otp')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function verifyEmail(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await api.verifyEmail(email, code)
      setSetupToken(res.setup_token)
      setInfo(t.login.emailVerified)
      setMode('signup-account')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function onRegister(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    if (password !== passwordConfirm) {
      setError(t.login.passwordMismatch)
      setBusy(false)
      return
    }
    try {
      const res = await registerAccount(setupToken, username, password, passwordConfirm)
      goAfterAuth(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`auth-screen ${isEn ? 'is-en' : 'tibetan'}`}>
      <section className="auth-hero">
        <div className="auth-hero-top">
          <div className="cms-lang auth-lang" role="group" aria-label="Language">
            <button type="button" className={lang === 'bo' ? 'is-active' : ''} onClick={() => setLang('bo')}>
              བོད།
            </button>
            <button type="button" className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>
              EN
            </button>
          </div>
        </div>
        <div className="auth-hero-brand">
          <p className="auth-eyebrow">{t.login.eyebrow}</p>
          <h1>{t.login.title}</h1>
          <p className="auth-hero-sub">{t.login.subtitle}</p>
          <Link to="/" className="auth-back-home">
            ← {t.cms.nav.home}
          </Link>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card panel">
          <div className="auth-mode-tabs" role="tablist">
            <button
              type="button"
              className={mode === 'login' ? 'is-active' : ''}
              onClick={() => switchMode('login')}
            >
              {t.login.tabLogin}
            </button>
            <button
              type="button"
              className={mode.startsWith('signup') ? 'is-active' : ''}
              onClick={() => switchMode('signup-email')}
            >
              {t.login.tabSignup}
            </button>
          </div>

          {mode === 'login' && (
            <div className="auth-form-block">
              <h2>{t.login.heading}</h2>
              <p className="sub">{t.login.sub}</p>
              <form onSubmit={onLogin}>
                <div className="field">
                  <label htmlFor="identifier">{t.login.identifier}</label>
                  <input
                    id="identifier"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={t.login.identifierHint}
                    dir="ltr"
                    autoComplete="username"
                  />
                </div>
                <div className="field">
                  <label htmlFor="password">{t.login.password}</label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    dir="ltr"
                    autoComplete="current-password"
                  />
                </div>
                {error && <p className="error">{error}</p>}
                <button className="btn btn-primary auth-submit" disabled={busy}>
                  {busy ? t.login.signingIn : t.login.signIn}
                </button>
              </form>
            </div>
          )}

          {mode === 'signup-email' && (
            <div className="auth-form-block">
              <h2>{t.login.signupHeading}</h2>
              <p className="sub">{t.login.signupSub}</p>
              <form onSubmit={sendOtp}>
                <div className="field">
                  <label htmlFor="email">{t.login.email}</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    dir="ltr"
                    autoComplete="email"
                  />
                </div>
                {error && <p className="error">{error}</p>}
                <button className="btn btn-primary auth-submit" disabled={busy}>
                  {busy ? t.login.sending : t.login.send}
                </button>
              </form>
            </div>
          )}

          {mode === 'signup-otp' && (
            <div className="auth-form-block">
              <h2>{t.login.verifyHeading}</h2>
              <p className="sub">{t.login.verifySub}</p>
              <form onSubmit={verifyEmail}>
                <div className="field">
                  <label htmlFor="code">{t.login.code}</label>
                  <input
                    id="code"
                    inputMode="numeric"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    dir="ltr"
                    autoComplete="one-time-code"
                  />
                </div>
                {info && <p className="success">{info}</p>}
                {error && <p className="error">{error}</p>}
                <button className="btn btn-primary auth-submit" disabled={busy}>
                  {busy ? t.login.verifying : t.login.verify}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost auth-submit auth-secondary"
                  onClick={() => switchMode('signup-email')}
                >
                  {t.login.differentEmail}
                </button>
              </form>
            </div>
          )}

          {mode === 'signup-account' && (
            <div className="auth-form-block">
              <h2>{t.login.accountHeading}</h2>
              <p className="sub">{t.login.accountSub}</p>
              <form onSubmit={onRegister}>
                <div className="field">
                  <label htmlFor="username">{t.login.username}</label>
                  <input
                    id="username"
                    required
                    minLength={3}
                    maxLength={32}
                    pattern="[A-Za-z0-9_]{3,32}"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t.login.usernameHint}
                    dir="ltr"
                    autoComplete="username"
                  />
                </div>
                <div className="field">
                  <label htmlFor="new-password">{t.login.password}</label>
                  <input
                    id="new-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    dir="ltr"
                    autoComplete="new-password"
                  />
                </div>
                <div className="field">
                  <label htmlFor="password-confirm">{t.login.passwordConfirm}</label>
                  <input
                    id="password-confirm"
                    type="password"
                    required
                    minLength={8}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    dir="ltr"
                    autoComplete="new-password"
                  />
                </div>
                {info && <p className="success">{info}</p>}
                {error && <p className="error">{error}</p>}
                <button className="btn btn-primary auth-submit" disabled={busy}>
                  {busy ? t.login.creatingAccount : t.login.createAccount}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
