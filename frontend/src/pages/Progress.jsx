import { useEffect, useState } from 'react'
import { api } from '../api/client'
import ProgressChart from '../components/ProgressChart'
import { bo } from '../i18n/bo'

export default function ProgressPage() {
  const [progress, setProgress] = useState(null)
  const [recs, setRecs] = useState([])
  const [rationale, setRationale] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      const [p, r] = await Promise.all([api.getProgress(), api.getRecommendations()])
      setProgress(p)
      setRecs(r.items || [])
      setRationale(r.rationale || '')
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function refresh() {
    setBusy(true)
    setError('')
    try {
      const p = await api.refreshProgress()
      setProgress(p)
      const r = await api.getRecommendations()
      setRecs(r.items || [])
      setRationale(r.rationale || '')
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
          <h1>{bo.progress.title}</h1>
          <p>{bo.progress.sub}</p>
        </div>
        <button className="btn btn-primary" onClick={refresh} disabled={busy}>
          {busy ? bo.progress.refreshing : bo.progress.refresh}
        </button>
      </header>
      {error && <p className="error">{error}</p>}
      <div className="grid-2">
        <ProgressChart progress={progress} />
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>{bo.progress.recommendations}</h3>
          {rationale && (
            <p style={{ color: 'var(--muted)' }} dir="ltr">
              {rationale}
            </p>
          )}
          {!recs.length && <p className="empty">{bo.progress.noRecs}</p>}
          {recs.map((item, i) => (
            <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }} dir="ltr">
                {item.content_type} · {item.level}
              </div>
              <strong>{item.title}</strong>
              <p style={{ margin: '6px 0 0' }} dir="ltr">
                {item.description}
              </p>
              {item.reason && (
                <p style={{ color: 'var(--muted)' }} dir="ltr">
                  {item.reason}
                </p>
              )}
            </div>
          ))}
          {progress?.learning_graph?.strengths && (
            <div style={{ marginTop: 16 }} dir="ltr">
              <h4>{bo.progress.strengths}</h4>
              <ul>
                {(progress.learning_graph.strengths || []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              <h4>{bo.progress.weaknesses}</h4>
              <ul>
                {(progress.learning_graph.weaknesses || []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
