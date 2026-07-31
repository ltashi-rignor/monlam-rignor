import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useModuleProgress } from '../hooks/useModuleProgress'
import { bo } from '../i18n/bo'
import { tibetanOrFallback } from '../i18n/labels'

export default function Lessons() {
  const { progress } = useModuleProgress()
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
  }, [])

  return (
    <div className="module-page tibetan">
      <header className="page-header">
        <div>
          <p className="module-eyebrow">{bo.modules.lessonsEyebrow}</p>
          <h1>{bo.modules.lessonsTitle}</h1>
          <p>{bo.modules.lessonsSubPath}</p>
          {tibetanOrFallback(meta.plan_title, '') && (
            <p className="muted" style={{ marginTop: 8 }}>
              {bo.modules.fromPath}: {tibetanOrFallback(meta.plan_title, '')} ·{' '}
              {bo.learningPath.currentWeek} {meta.current_week}
            </p>
          )}
        </div>
        <Link className="btn btn-ghost" to="/learning-path">
          {bo.modules.openPath}
        </Link>
      </header>

      {error && <p className="error">{error}</p>}

      {loading && <div className="empty panel">{bo.loading}</div>}

      {!loading && meta.message === 'no_plan' && (
        <div className="panel empty tibetan">
          <p>{bo.modules.needPlan}</p>
          <Link className="btn btn-primary" to="/learning-path">
            {bo.modules.createPlan}
          </Link>
        </div>
      )}

      {!loading && meta.message !== 'no_plan' && !lessons.length && (
        <div className="empty panel">{bo.modules.noPathLessons}</div>
      )}

      <div className="lessons-list">
        {lessons.map((l, i) => {
          const done = doneSet.includes(l.id)
          const title = tibetanOrFallback(l.tibetan_title || l.title, l.title)
          const focus = tibetanOrFallback(l.focus, '')
          return (
            <Link key={l.id} to={`/lessons/${l.id}`} className="lesson-row panel">
              <div className={`lesson-num ${done ? 'is-done' : ''}`}>
                {done ? '✓' : String(i + 1).padStart(2, '0')}
              </div>
              <div className="lesson-row-body">
                <div className="lesson-row-top">
                  <h3>{title}</h3>
                  <span className="chip">
                    {bo.learningPath.week} {l.week_number}
                  </span>
                  {l.ready && <span className="chip chip-ready">{bo.modules.ready}</span>}
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
