import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useModuleProgress } from '../hooks/useModuleProgress'
import { useI18n } from '../i18n/useI18n'
import { statusBo, tibetanOrFallback } from '../i18n/labels'

export default function Lessons() {
  const { t } = useI18n()

  const { progress, refresh } = useModuleProgress()
  const doneSet = progress.completed_lessons || []
  const [lessons, setLessons] = useState([])
  const [meta, setMeta] = useState({ plan_title: '', current_week: 1, message: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        await refresh()
        const data = await api.listInteractiveLessons()
        if (cancelled) return
        setLessons(data.lessons || [])
        setMeta({
          plan_title: data.plan_title || '',
          current_week: data.current_week || 1,
          message: data.message || '',
        })
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const stats = useMemo(() => {
    const total = lessons.length
    const completed = lessons.filter(
      (l) => l.status === 'completed' || doneSet.includes(l.id),
    ).length
    const inProgress = lessons.filter(
      (l) =>
        l.status === 'in_progress' &&
        !doneSet.includes(l.id) &&
        l.status !== 'completed',
    ).length
    const weighted = completed + inProgress * 0.5
    return {
      total,
      completed,
      inProgress,
      pct: total ? Math.round((weighted / total) * 100) : 0,
    }
  }, [lessons, doneSet])

  return (
    <div className="module-page tibetan">
      <header className="page-header">
        <div>
          <p className="module-eyebrow">{t.modules.lessonsEyebrow}</p>
          <h1>{t.modules.lessonsTitle}</h1>
          <p>{t.modules.lessonsSubPath}</p>
          {tibetanOrFallback(meta.plan_title, '') && (
            <p className="muted" style={{ marginTop: 8 }}>
              {t.modules.fromPath}: {tibetanOrFallback(meta.plan_title, '')} ·{' '}
              {t.learningPath.currentWeek} {meta.current_week}
            </p>
          )}
        </div>
        <Link className="btn btn-ghost" to="/learning-path">
          {t.modules.openPath}
        </Link>
      </header>

      {error && <p className="error">{error}</p>}

      {loading && <div className="empty panel">{t.loading}</div>}

      {!loading && meta.message === 'no_plan' && (
        <div className="panel empty tibetan">
          <p>{t.modules.needPlan}</p>
          <Link className="btn btn-primary" to="/learning-path">
            {t.modules.createPlan}
          </Link>
        </div>
      )}

      {!loading && meta.message !== 'no_plan' && !lessons.length && (
        <div className="empty panel">{t.modules.noPathLessons}</div>
      )}

      {!loading && lessons.length > 0 && (
        <div className="path-overview panel" style={{ marginBottom: 16 }}>
          <div className="path-overview-stats">
            <div className="stat-chip">
              <span>{t.learningPath.progress}</span>
              <strong dir="ltr">
                {stats.completed}/{stats.total} · {stats.pct}%
              </strong>
            </div>
            <div className="stat-chip">
              <span>{t.modules.xp}</span>
              <strong dir="ltr">{progress.xp || 0}</strong>
            </div>
          </div>
          <div className="overview-progress" aria-hidden>
            <div className="overview-progress-fill" style={{ width: `${stats.pct}%` }} />
          </div>
        </div>
      )}

      <div className="lessons-list">
        {lessons.map((l, i) => {
          const done = l.status === 'completed' || doneSet.includes(l.id)
          const inProgress = !done && l.status === 'in_progress'
          const title = tibetanOrFallback(l.tibetan_title || l.title, l.title)
          const focus = tibetanOrFallback(l.focus, '')
          return (
            <Link key={l.id} to={`/lessons/${l.id}`} className="lesson-row panel">
              <div className={`lesson-num ${done ? 'is-done' : ''} ${inProgress ? 'is-active' : ''}`}>
                {done ? '✓' : String(i + 1).padStart(2, '0')}
              </div>
              <div className="lesson-row-body">
                <div className="lesson-row-top">
                  <h3>{title}</h3>
                  <span className="chip">
                    {t.learningPath.week} {l.week_number}
                  </span>
                  <span className="chip">{statusBo(done ? 'completed' : l.status || 'pending')}</span>
                  {l.ready && <span className="chip chip-ready">{t.modules.ready}</span>}
                </div>
                {focus && <p className="muted">{focus}</p>}
              </div>
              <div className="lesson-mins muted" dir="ltr">
                {l.minutes} min
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
