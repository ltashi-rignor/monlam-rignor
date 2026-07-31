import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { bo } from '../i18n/bo'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const loginWithOtp = useAuthStore((s) => s.loginWithOtp)
  const navigate = useNavigate()

  async function sendOtp(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.requestOtp(email)
      setInfo(bo.login.otpSent)
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
      navigate(res.profile_complete ? '/dashboard' : '/onboarding')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen tibetan">
      <section className="auth-hero">
        <p style={{ letterSpacing: '0.08em', opacity: 0.75 }}>{bo.login.eyebrow}</p>
        <h1>{bo.login.title}</h1>
        <p>{bo.login.subtitle}</p>
      </section>
      <section className="auth-panel">
        <div className="auth-card panel">
          <h2>{bo.login.heading}</h2>
          <p className="sub">{bo.login.sub}</p>
          {step === 'email' ? (
            <form onSubmit={sendOtp}>
              <div className="field">
                <label htmlFor="email">{bo.login.email}</label>
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
                {busy ? bo.login.sending : bo.login.send}
              </button>
            </form>
          ) : (
            <form onSubmit={verify}>
              <div className="field">
                <label htmlFor="code">{bo.login.code}</label>
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
                {busy ? bo.login.verifying : bo.login.verify}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => setStep('email')}
              >
                {bo.login.differentEmail}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
