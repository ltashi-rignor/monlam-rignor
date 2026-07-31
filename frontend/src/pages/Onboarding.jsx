import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { bo } from '../i18n/bo'
import { useAuthStore } from '../store/authStore'

function initialForm(user) {
  return {
    name: user?.name || '',
    age: user?.age ?? 10,
    school_class: user?.school_class || 'འཛིན་གྲ་ ༥',
    likes: user?.likes || 'སེམས་ཅན། རྩེད་མོ། རི་མོ།',
    favorites: user?.favorites || 'གཡག་གི་གཏམ་རྒྱུད། བོད་གླུ།',
  }
}

export default function Onboarding() {
  const user = useAuthStore((s) => s.user)
  const refreshUser = useAuthStore((s) => s.refreshUser)
  const navigate = useNavigate()
  const editing = Boolean(user?.profile_complete)

  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [regeneratePlan, setRegeneratePlan] = useState(true)
  const [form, setForm] = useState(() => initialForm(user))

  const copy = useMemo(
    () => ({
      title: editing ? bo.onboarding.editTitle : bo.onboarding.title,
      sub: editing ? bo.onboarding.editSub : bo.onboarding.sub,
      save: editing
        ? regeneratePlan
          ? bo.onboarding.saveAndRegen
          : bo.onboarding.saveOnly
        : bo.onboarding.save,
    }),
    [editing, regeneratePlan],
  )

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setStatus(bo.onboarding.saving)
    try {
      await api.updateProfile({
        ...form,
        age: Number(form.age),
      })

      const shouldPlan = !editing || regeneratePlan
      if (shouldPlan) {
        setStatus(bo.onboarding.planning)
        try {
          await api.generateRoadmap(editing)
        } catch (roadmapErr) {
          setError(roadmapErr.message)
          await refreshUser()
          navigate('/dashboard')
          return
        }
      }

      await refreshUser()
      navigate(editing ? '/learning-path' : '/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  return (
    <div className="auth-screen tibetan" style={{ gridTemplateColumns: '1fr' }}>
      <section className="auth-panel">
        <div className="auth-card panel" style={{ width: 'min(560px, 100%)' }}>
          <h2>{copy.title}</h2>
          <p className="sub">{copy.sub}</p>
          <form onSubmit={submit}>
            <div className="field">
              <label>{bo.onboarding.name}</label>
              <input required value={form.name} onChange={(e) => update('name', e.target.value)} />
            </div>
            <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>{bo.onboarding.age}</label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  required
                  value={form.age}
                  onChange={(e) => update('age', e.target.value)}
                  dir="ltr"
                />
              </div>
              <div className="field">
                <label>{bo.onboarding.schoolClass}</label>
                <input
                  required
                  value={form.school_class}
                  onChange={(e) => update('school_class', e.target.value)}
                  placeholder={bo.onboarding.classPh}
                />
              </div>
            </div>
            <div className="field">
              <label>{bo.onboarding.likes}</label>
              <textarea
                rows={2}
                required
                value={form.likes}
                onChange={(e) => update('likes', e.target.value)}
                placeholder={bo.onboarding.likesPh}
              />
            </div>
            <div className="field">
              <label>{bo.onboarding.favorites}</label>
              <textarea
                rows={2}
                required
                value={form.favorites}
                onChange={(e) => update('favorites', e.target.value)}
                placeholder={bo.onboarding.favoritesPh}
              />
            </div>
            {editing && (
              <label className="field-check">
                <input
                  type="checkbox"
                  checked={regeneratePlan}
                  onChange={(e) => setRegeneratePlan(e.target.checked)}
                />
                <span>{bo.onboarding.regenPlan}</span>
              </label>
            )}
            {status && <p className="success">{status}</p>}
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" disabled={busy} style={{ width: '100%' }}>
              {busy ? status || bo.loading : copy.save}
            </button>
            {editing && (
              <Link
                to="/dashboard"
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: 10, textAlign: 'center' }}
              >
                {bo.onboarding.back}
              </Link>
            )}
          </form>
        </div>
      </section>
    </div>
  )
}
