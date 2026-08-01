import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useI18n } from '../i18n/useI18n'
import { safeNextPath } from '../lib/requireAuth'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const { t, lang, setLang, isEn } = useI18n()
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const loginWithOtp = useAuthStore((s) => s.loginWithOtp)
  const navigate = useNavigate()
  const [params] = useSearchParams()

  async function sendOtp(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.requestOtp(email)
      setInfo(t.login.otpSent)
      setStep('otp')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function verify(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await loginWithOtp(email, code)
      if (!res.profile_complete) {
        navigate('/onboarding')
        return
      }
      navigate(safeNextPath(params.get('next'), '/dashboard'))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`auth-screen ${isEn ? 'is-en' : 'tibetan'}`}>
      <section className="auth-hero">
        <div className="cms-lang auth-lang" role="group" aria-label="Language">
          <button type="button" className={lang === 'bo' ? 'is-active' : ''} onClick={() => setLang('bo')}>
            བོད།
          </button>
          <button type="button" className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>
            EN
          </button>
        </div>
        <p style={{ letterSpacing: '0.08em', opacity: 0.75 }}>{t.login.eyebrow}</p>
        <h1>{t.login.title}</h1>
        <p>{t.login.subtitle}</p>
        <Link to="/" className="auth-back-home">
          ← {t.cms.nav.home}
        </Link>
      </section>
      <section className="auth-panel">
        <div className="auth-card panel">
          <h2>{t.login.heading}</h2>
          <p className="sub">{t.login.sub}</p>
          {step === 'email' ? (
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
                />
              </div>
              {error && <p className="error">{error}</p>}
              <button className="btn btn-primary" disabled={busy} style={{ width: '100%' }}>
                {busy ? t.login.sending : t.login.send}
              </button>
            </form>
          ) : (
            <form onSubmit={verify}>
              <div className="field">
                <label htmlFor="code">{t.login.code}</label>
                <input
                  id="code"
                  inputMode="numeric"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  dir="ltr"
                />
              </div>
              {info && <p className="success">{info}</p>}
              {error && <p className="error">{error}</p>}
              <button className="btn btn-primary" disabled={busy} style={{ width: '100%' }}>
                {busy ? t.login.verifying : t.login.verify}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => setStep('email')}
              >
                {t.login.differentEmail}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
