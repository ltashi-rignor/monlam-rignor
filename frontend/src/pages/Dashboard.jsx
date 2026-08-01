import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import ProgressChart from '../components/ProgressChart'
import { useI18n } from '../i18n/useI18n'
import {
  exerciseCountBo,
  lessonTypeBo,
  statusBo,
  tibetanOrFallback,
} from '../i18n/labels'
import { useAuthStore } from '../store/authStore'

export default function Dashboard() {
  const { t, isEn, lang } = useI18n()
  const storeUser = useAuthStore((s) => s.user)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    if (!data) setLoading(true)
    try {
      const summary = await api.getDashboard()
      setData(summary)
    } catch (err) {
      setError(err.message || t.dashboard.retry)
    } finally {
      setLoading(false)
    }
  }, [data, t.dashboard.retry])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const summary = await api.getDashboard()
        if (!cancelled) setData(summary)
      } catch (err) {
        if (!cancelled) setError(err.message || t.dashboard.retry)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t.dashboard.retry])

  if (loading && !data) {
    return <div className="empty panel">{t.dashboard.loading}</div>
  }

  if (error || !data) {
    return (
      <div className="panel">
        <p className="error">{error || '—'}</p>
        <button type="button" className="btn btn-primary" onClick={load}>
          {t.dashboard.retry}
        </button>
      </div>
    )
  }

  const profile = data.profile || {}
  const name = profile.name || storeUser?.name || ''
  const progress = {
    grammar_score: data.progress?.grammar_score || 0,
    writing_score: data.progress?.writing_score || 0,
    reading_score: data.progress?.reading_score || 0,
    speaking_score: data.progress?.speaking_score || 0,
    vocabulary_score: data.progress?.vocabulary_score || 0,
    learning_graph: {},
  }
  const weekLessons = data.current_week_lessons || []
  const next = data.next_lesson
  const practice = data.latest_practice
  const essays = data.recent_essays || []
  const currentWeek = data.roadmap?.current_week || 1
  const roadmapTitle = tibetanOrFallback(data.roadmap?.title, t.dashboard.path, lang)

  return (
    <div className={`dash ${isEn ? 'is-en' : 'tibetan'}`} lang={lang}>
      <header className="page-header dash-hero">
        <div className="dash-hero-copy">
          <h1>
            {t.dashboard.welcome}
            {name ? ` ${name}` : ''}
          </h1>
          <p>{t.dashboard.sub}</p>
          <div className="dash-profile-chips">
            {profile.age != null && (
              <span className="chip">
                {t.dashboard.age} <b dir="ltr">{profile.age}</b>
              </span>
            )}
            {profile.school_class && (
              <span className="chip">
                {t.dashboard.classLabel} <b>{profile.school_class}</b>
              </span>
            )}
            {profile.likes && (
              <span className="chip">
                {t.dashboard.likes} <b>{profile.likes}</b>
              </span>
            )}
            {profile.favorites && (
              <span className="chip">
                {t.dashboard.favorites} <b>{profile.favorites}</b>
              </span>
            )}
          </div>
        </div>
        <div className="dash-hero-actions">
          {next ? (
            <Link className="btn btn-primary" to={`/lessons/${next.id}`}>
              {t.dashboard.continueLearning}
            </Link>
          ) : (
            <Link className="btn btn-primary" to="/learning-path">
              {data.roadmap ? t.dashboard.viewRoadmap : t.dashboard.createPlan}
            </Link>
          )}
          <Link className="btn btn-accent" to="/practice">
            {t.dashboard.todayPractice}
          </Link>
          <Link className="btn btn-ghost" to="/onboarding">
            {t.dashboard.editProfile}
          </Link>
        </div>
      </header>

      <section className="grid-3 dash-stats">
        <div className="stat">
          <div className="label">{t.dashboard.path}</div>
          <div className="value value-sm">{roadmapTitle}</div>
          <div className="stat-meta">
            {t.dashboard.week} <span dir="ltr">{currentWeek}</span>
          </div>
        </div>
        <div className="stat">
          <div className="label">{t.dashboard.grammar}</div>
          <div className="value" dir="ltr">
            {Math.round(progress.grammar_score)}
          </div>
        </div>
        <div className="stat">
          <div className="label">{t.dashboard.writing}</div>
          <div className="value" dir="ltr">
            {Math.round(progress.writing_score)}
          </div>
        </div>
      </section>

      <div className="grid-2 dash-main">
        <section className="panel">
          <div className="dash-section-head">
            <h3 style={{ margin: 0 }}>
              {t.dashboard.thisWeek}{' '}
              <span dir="ltr">({currentWeek})</span>
            </h3>
            <Link className="btn btn-ghost" to="/learning-path">
              {t.dashboard.viewRoadmap}
            </Link>
          </div>

          {next && (
            <div className="dash-next">
              <div className="meta">{t.dashboard.nextUp}</div>
              <h4 style={{ margin: '6px 0' }}>
                {tibetanOrFallback(next.title, t.dashboard.continueLearning, lang)}
              </h4>
              <div className="meta">
                {lessonTypeBo(next.lesson_type, lang)} · {statusBo(next.status, lang)}
              </div>
              <Link className="btn btn-primary" to={`/lessons/${next.id}`} style={{ marginTop: 10 }}>
                {t.learningPath.goToCourse}
              </Link>
            </div>
          )}

          {!weekLessons.length && <p className="empty">{t.dashboard.noLessons}</p>}

          <div className="dash-lesson-list">
            {weekLessons.map((lesson) => (
              <Link key={lesson.id} to={`/lessons/${lesson.id}`} className="dash-lesson">
                <div className="meta">
                  {lessonTypeBo(lesson.lesson_type, lang)} · {statusBo(lesson.status, lang)}
                </div>
                <strong>
                  {tibetanOrFallback(lesson.title, lessonTypeBo(lesson.lesson_type, lang), lang)}
                </strong>
              </Link>
            ))}
          </div>

          <div className="dash-quick">
            <Link className="btn btn-primary" to="/grammar">
              {t.dashboard.checkGrammar}
            </Link>
            <Link className="btn btn-ghost" to="/essay">
              {t.dashboard.writeEssay}
            </Link>
            <Link className="btn btn-accent" to="/practice">
              {t.dashboard.todayPractice}
            </Link>
          </div>
        </section>

        <div className="dash-side">
          <ProgressChart progress={progress} compact />

          <section className="panel">
            <h3 style={{ marginTop: 0 }}>{t.dashboard.activity}</h3>
            <div className="dash-activity">
              <div>
                <span className="label">{t.dashboard.mistakes}</span>
                <strong dir="ltr">{data.mistake_count}</strong>
              </div>
              <div>
                <span className="label">{t.dashboard.practicesDone}</span>
                <strong dir="ltr">{data.practice_completed_count}</strong>
              </div>
              <div>
                <span className="label">{t.dashboard.essays}</span>
                <strong dir="ltr">{data.essay_count}</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <h3 style={{ marginTop: 0 }}>{t.dashboard.practiceStatus}</h3>
            {!practice && <p className="empty">{t.dashboard.noPractice}</p>}
            {practice && (
              <>
                <strong>{tibetanOrFallback(practice.title, t.nav.practice, lang)}</strong>
                <p className="muted">
                  {practice.completed ? t.dashboard.practiceDone : t.dashboard.practiceOpen}
                  {practice.score != null && (
                    <>
                      {' '}
                      · {t.dashboard.score}{' '}
                      <span dir="ltr">{Math.round(practice.score)}</span>
                    </>
                  )}
                  {' · '}
                  {exerciseCountBo(practice.exercise_count || 0, lang)}
                </p>
                <Link className="btn btn-primary" to="/practice" style={{ marginTop: 10 }}>
                  {t.dashboard.todayPractice}
                </Link>
              </>
            )}
          </section>

          <section className="panel">
            <h3 style={{ marginTop: 0 }}>{t.dashboard.recentEssays}</h3>
            {!essays.length && <p className="empty">{t.dashboard.noEssays}</p>}
            {essays.map((e) => (
              <div key={e.id} className="dash-essay-row">
                <strong>{tibetanOrFallback(e.title, t.dashboard.untitled, lang)}</strong>
                <span dir="ltr">{Math.round(e.overall_score || 0)}</span>
              </div>
            ))}
            <Link className="btn btn-ghost" to="/essay" style={{ marginTop: 10 }}>
              {t.dashboard.writeEssay}
            </Link>
          </section>
        </div>
      </div>
    </div>
  )
}
