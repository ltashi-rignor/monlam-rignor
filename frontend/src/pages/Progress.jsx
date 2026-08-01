import { useEffect, useState } from 'react'
import { api } from '../api/client'
import ProgressChart from '../components/ProgressChart'
import { useI18n } from '../i18n/useI18n'
import { tibetanOrFallback } from '../i18n/labels'

export default function ProgressPage() {
  const { t, isEn } = useI18n()
  const [progress, setProgress] = useState(null)
  const [recs, setRecs] = useState([])
  const [rationale, setRationale] = useState('')
  const [recsLoading, setRecsLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Fast path: DB progress only — do not block on Melong recommendations
      try {
        const p = await api.getProgress()
        if (!cancelled) setProgress(p)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }

      setRecsLoading(true)
      try {
        const r = await api.getRecommendations()
        if (!cancelled) {
          setRecs(r.items || [])
          setRationale(r.rationale || '')
        }
      } catch {
        /* recommendations are optional for page usability */
      } finally {
        if (!cancelled) setRecsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function refresh() {
    setBusy(true)
    setError('')
    try {
      const p = await api.refreshProgress()
      setProgress(p)
      setRecsLoading(true)
      const r = await api.getRecommendations()
      setRecs(r.items || [])
      setRationale(r.rationale || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setRecsLoading(false)
    }
  }

  return (
    <div className={isEn ? 'is-en' : 'tibetan'}>
      <header className="page-header">
        <div>
          <h1>{t.progress.title}</h1>
          <p>{t.progress.sub}</p>
        </div>
        <button className="btn btn-primary" onClick={refresh} disabled={busy}>
          {busy ? t.progress.refreshing : t.progress.refresh}
        </button>
      </header>
      {error && <p className="error">{error}</p>}
      <div className="grid-2">
        <ProgressChart progress={progress} />
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>{t.progress.recommendations}</h3>
          {recsLoading && !recs.length && <p className="muted">{t.loading}</p>}
          {tibetanOrFallback(rationale, '') && (
            <p style={{ color: 'var(--muted)' }}>{tibetanOrFallback(rationale, '')}</p>
          )}
          {!recsLoading && !recs.length && <p className="empty">{t.progress.noRecs}</p>}
          {recs.map((item, i) => (
            <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                {item.content_type} · {item.level}
              </div>
              <strong>{tibetanOrFallback(item.title, item.content_type)}</strong>
              {tibetanOrFallback(item.description, '') && (
                <p style={{ margin: '6px 0 0' }}>{tibetanOrFallback(item.description, '')}</p>
              )}
              {tibetanOrFallback(item.reason, '') && (
                <p style={{ color: 'var(--muted)' }}>{tibetanOrFallback(item.reason, '')}</p>
              )}
            </div>
          ))}
          {progress?.learning_graph?.strengths && (
            <div style={{ marginTop: 16 }}>
              <h4>{t.progress.strengths}</h4>
              <ul>
                {(progress.learning_graph.strengths || []).map((s, i) => (
                  <li key={i}>{tibetanOrFallback(s, s)}</li>
                ))}
              </ul>
              <h4>{t.progress.weaknesses}</h4>
              <ul>
                {(progress.learning_graph.weaknesses || []).map((s, i) => (
                  <li key={i}>{tibetanOrFallback(s, s)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
