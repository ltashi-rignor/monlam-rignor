import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, clearApiCache } from '../api/client'
import ProgressChart from '../components/ProgressChart'
import WorkingProgress from '../components/WorkingProgress'
import { useI18n } from '../i18n/useI18n'
import { tibetanOrFallback } from '../i18n/labels'

function formatWhen(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

function statsFromHistory(rows) {
  const completed = (rows || []).filter((r) => r.completed && r.score != null)
  if (!completed.length) {
    return { completed_count: 0, last_score: 0, avg_score: 0 }
  }
  const scores = completed.map((r) => Number(r.score) || 0)
  return {
    completed_count: completed.length,
    last_score: scores[0],
    avg_score: scores.reduce((a, b) => a + b, 0) / scores.length,
  }
}

export default function ProgressPage() {
  const { t, isEn } = useI18n()
  const [progress, setProgress] = useState(null)
  const [practiceRows, setPracticeRows] = useState([])
  const [recs, setRecs] = useState([])
  const [rationale, setRationale] = useState('')
  const [recsLoading, setRecsLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadCore() {
    clearApiCache('GET:/api/progress')
    clearApiCache('GET:/api/practice')
    const [p, practices] = await Promise.all([
      api.getProgress(),
      api.practiceHistory().catch(() => []),
    ])
    setProgress(p)
    setPracticeRows(Array.isArray(practices) ? practices.slice(0, 8) : [])
    return p
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        if (!cancelled) await loadCore()
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }

      setRecsLoading(true)
      try {
        const r = await api.getRecommendations()
        if (!cancelled) {
          setRecs(r.items || [])
          setRationale(r.rationale || '')
        }
      } catch {
        /* optional */
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
      clearApiCache('GET:/api/progress')
      const p = await api.refreshProgress()
      setProgress(p)
      const practices = await api.practiceHistory().catch(() => [])
      setPracticeRows(Array.isArray(practices) ? practices.slice(0, 8) : [])
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

  const practiceStats = useMemo(() => {
    const fromGraph = progress?.learning_graph?.practice_stats
    if (fromGraph && (fromGraph.completed_count || 0) > 0) return fromGraph
    return statsFromHistory(practiceRows)
  }, [progress, practiceRows])

  const activity = progress?.learning_graph?.activity || {}
  const completedPractices = practiceRows.filter((r) => r.completed)
  const hasAnyTrack =
    (practiceStats.completed_count || 0) > 0 ||
    (activity.mistake_count || 0) > 0 ||
    (activity.xp || 0) > 0 ||
    (activity.mastered_letters || 0) > 0 ||
    (activity.completed_lessons || 0) > 0 ||
    Number(progress?.grammar_score || 0) > 0

  return (
    <div className={`progress-page ${isEn ? 'is-en' : 'tibetan'}`}>
      <header className="page-header">
        <div>
          <h1>{t.progress.title}</h1>
          <p>{t.progress.sub}</p>
        </div>
        <div className="progress-header-actions">
          <Link className="btn btn-ghost" to="/practice">
            {t.progress.goPractice}
          </Link>
          <button className="btn btn-primary" onClick={refresh} disabled={busy || loading}>
            {busy ? t.progress.refreshing : t.progress.refresh}
          </button>
        </div>
      </header>
      {error && <p className="error">{error}</p>}

      <WorkingProgress
        active={busy}
        title={t.progress.refreshing}
        stages={[t.progress.refreshStage1, t.progress.refreshStage2, t.progress.refreshStage3]}
        compact
      />

      {loading && !progress ? (
        <div className="empty panel">{t.loading}</div>
      ) : (
        <>
          <section className="panel progress-practice-strip">
            <div className="progress-practice-head">
              <h3 style={{ margin: 0 }}>{t.progress.practiceTitle}</h3>
              <Link to="/practice">{t.progress.goPractice}</Link>
            </div>

            <div className="progress-practice-stats">
              <div className="stat-chip">
                <span>{t.progress.practiceDone}</span>
                <strong dir="ltr">{practiceStats.completed_count ?? 0}</strong>
              </div>
              <div className="stat-chip">
                <span>{t.progress.practiceAvg}</span>
                <strong dir="ltr">{Math.round(practiceStats.avg_score ?? 0)}</strong>
              </div>
              <div className="stat-chip">
                <span>{t.progress.practiceLast}</span>
                <strong dir="ltr">{Math.round(practiceStats.last_score ?? 0)}</strong>
              </div>
              <div className="stat-chip">
                <span>{t.progress.mistakesTracked}</span>
                <strong dir="ltr">{activity.mistake_count ?? 0}</strong>
              </div>
              <div className="stat-chip">
                <span>{t.progress.lettersMastered}</span>
                <strong dir="ltr">{activity.mastered_letters ?? 0}</strong>
              </div>
              <div className="stat-chip">
                <span>{t.progress.lessonsDone}</span>
                <strong dir="ltr">{activity.completed_lessons ?? 0}</strong>
              </div>
              <div className="stat-chip">
                <span>XP</span>
                <strong dir="ltr">{activity.xp ?? 0}</strong>
              </div>
            </div>

            {!hasAnyTrack && (
              <p className="muted" style={{ marginBottom: 0 }}>
                {t.progress.trackHint}
              </p>
            )}

            {!!completedPractices.length && (
              <ul className="progress-practice-list">
                {completedPractices.map((row) => (
                  <li key={row.id}>
                    <span className="progress-practice-title">
                      {row.exercises_json?.title || t.practice.title}
                    </span>
                    <span className="muted" dir="ltr">
                      {formatWhen(row.created_at)} · {Math.round(row.score ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

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
              {!!progress?.learning_graph?.next_focus?.length && (
                <div style={{ marginTop: 16 }}>
                  <h4>{t.progress.nextFocus}</h4>
                  <ul>
                    {(progress.learning_graph.next_focus || []).map((s, i) => (
                      <li key={i}>{tibetanOrFallback(s, s)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!!progress?.learning_graph?.strengths?.length && (
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
        </>
      )}
    </div>
  )
}
