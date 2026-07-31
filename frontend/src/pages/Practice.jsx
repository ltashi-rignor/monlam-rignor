import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { bo } from '../i18n/bo'

function optionLabel(opt) {
  if (opt == null) return ''
  if (typeof opt === 'string' || typeof opt === 'number') return String(opt)
  if (typeof opt === 'object') return String(opt.text ?? opt.label ?? opt.value ?? JSON.stringify(opt))
  return String(opt)
}

function optionValue(opt) {
  if (opt == null) return ''
  if (typeof opt === 'string' || typeof opt === 'number') return String(opt)
  if (typeof opt === 'object') return String(opt.value ?? opt.text ?? opt.label ?? '')
  return String(opt)
}

function exerciseKey(ex, index) {
  return ex?.id != null ? String(ex.id) : `ex-${index}`
}

function normalizeAnswer(value) {
  if (Array.isArray(value)) return value.join(', ')
  if (value == null) return ''
  return String(value)
}

export default function Practice() {
  const [session, setSession] = useState(null)
  const [answers, setAnswers] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const latest = await api.request('/api/practice/latest')
        setSession(latest)
      } catch {
        /* empty */
      }
    })()
  }, [])

  async function generate() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const data = await api.generatePractice()
      setSession(data)
      setAnswers({})
      setMessage(bo.practice.ready)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!session) return
    setBusy(true)
    setError('')
    try {
      const exercises = session.exercises_json?.exercises || []
      let correct = 0
      exercises.forEach((ex, index) => {
        const key = exerciseKey(ex, index)
        const given = String(answers[key] || '').trim()
        const expected = normalizeAnswer(ex.answer).trim()
        if (given && expected && given === expected) correct += 1
      })
      const score = exercises.length ? (correct / exercises.length) * 100 : 0
      const updated = await api.submitPractice({
        practice_id: session.id,
        answers,
        score,
      })
      setSession(updated)
      setMessage(`${bo.practice.submitted} ${Math.round(score)}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const exercises = Array.isArray(session?.exercises_json?.exercises)
    ? session.exercises_json.exercises
    : []

  return (
    <div className="tibetan">
      <header className="page-header">
        <div>
          <h1>{bo.practice.title}</h1>
          <p>{bo.practice.sub}</p>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={busy}>
          {busy ? bo.practice.generating : bo.practice.generate}
        </button>
      </header>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      {!session && <div className="empty panel">{bo.practice.empty}</div>}

      {session && exercises.length === 0 && (
        <div className="empty panel">{bo.practice.noExercises}</div>
      )}

      {session && exercises.length > 0 && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{session.exercises_json?.title || bo.practice.title}</h2>
          <p style={{ color: 'var(--muted)' }} dir="ltr">
            {bo.practice.focus}: {(session.exercises_json?.focus_areas || []).join(' · ') || '—'}
          </p>
          {exercises.map((ex, index) => {
            const key = exerciseKey(ex, index)
            const options = Array.isArray(ex.options) ? ex.options : []
            return (
              <div
                key={key}
                style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}
              >
                <div className="meta" style={{ color: 'var(--muted)', fontSize: '0.85rem' }} dir="ltr">
                  {ex.type || 'exercise'} · #{index + 1}
                </div>
                <p className="tibetan">{ex.prompt}</p>
                {options.length ? (
                  <select
                    value={answers[key] || ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))}
                  >
                    <option value="">{bo.practice.select}</option>
                    {options.map((opt, oi) => (
                      <option key={`${key}-opt-${oi}`} value={optionValue(opt)}>
                        {optionLabel(opt)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="tibetan"
                    style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--line)' }}
                    value={answers[key] || ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))}
                  />
                )}
                {session.completed && (
                  <div style={{ marginTop: 8 }}>
                    <p className="tibetan" style={{ margin: 0 }}>
                      {bo.practice.answer}: {normalizeAnswer(ex.answer)}
                    </p>
                    {ex.explanation && (
                      <p style={{ color: 'var(--muted)', margin: '4px 0 0' }} dir="ltr">
                        {ex.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {!session.completed && (
            <button className="btn btn-accent" onClick={submit} disabled={busy}>
              {bo.practice.submit}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
