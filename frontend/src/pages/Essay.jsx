import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { bo } from '../i18n/bo'

export default function Essay() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function loadHistory() {
    try {
      setHistory(await api.essayHistory())
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await api.submitEssay({ title, content, run_grammar: true })
      setResult(data)
      await loadHistory()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tibetan">
      <header className="page-header">
        <div>
          <h1>{bo.essay.title}</h1>
          <p>{bo.essay.sub}</p>
        </div>
      </header>

      <div className="grid-2">
        <form className="panel" onSubmit={submit}>
          <div className="field">
            <label>{bo.essay.titleLabel}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={bo.essay.titlePh}
            />
          </div>
          <div className="field">
            <label>{bo.essay.body}</label>
            <textarea
              className="tibetan"
              rows={14}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? bo.essay.evaluating : bo.essay.submit}
          </button>
        </form>

        <div>
          {result && (
            <div className="panel" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>{bo.essay.evaluation}</h3>
              <div className="grid-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div className="stat">
                  <div className="label">{bo.essay.overall}</div>
                  <div className="value" dir="ltr">
                    {Math.round(result.overall_score || 0)}
                  </div>
                </div>
                <div className="stat">
                  <div className="label">{bo.essay.grammar}</div>
                  <div className="value" dir="ltr">
                    {Math.round(result.grammar_score || 0)}
                  </div>
                </div>
                <div className="stat">
                  <div className="label">{bo.essay.vocabulary}</div>
                  <div className="value" dir="ltr">
                    {Math.round(result.vocabulary_score || 0)}
                  </div>
                </div>
                <div className="stat">
                  <div className="label">{bo.essay.fluency}</div>
                  <div className="value" dir="ltr">
                    {Math.round(result.fluency_score || 0)}
                  </div>
                </div>
              </div>
              <p dir="ltr">
                {bo.essay.readingLevel}: <strong>{result.reading_level}</strong>
              </p>
              <h4>{bo.essay.suggestions}</h4>
              <ul dir="ltr">
                {(result.suggestions || []).map((s, i) => (
                  <li key={i}>{typeof s === 'string' ? s : JSON.stringify(s)}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>{bo.essay.history}</h3>
            {!history.length && <p className="empty">{bo.essay.noEssays}</p>}
            {history.map((e) => (
              <div key={e.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <strong>{e.title || bo.essay.untitled}</strong> · {bo.essay.score}{' '}
                <span dir="ltr">{Math.round(e.overall_score || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
