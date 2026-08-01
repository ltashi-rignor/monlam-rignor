import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import BarChart from '../components/charts/BarChart'
import LineChart from '../components/charts/LineChart'
import RadarChart from '../components/charts/RadarChart'
import RingStat from '../components/charts/RingStat'
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
  }
  const weekLessons = data.current_week_lessons || []
  const next = data.next_lesson
  const practice = data.latest_practice
  const currentWeek = data.roadmap?.current_week || 1
  const roadmapTitle = tibetanOrFallback(data.roadmap?.title, t.dashboard.path, lang)
  const weekCompletion = data.week_completion || { total: 0, completed: 0 }
  const practiceScores = (data.practice_scores || []).map((p) => ({
    date: p.date,
    value: p.score,
  }))
  const activitySeries = data.activity_series || []
  const skillItems = [
    { key: 'grammar', label: t.progress.grammar, value: progress.grammar_score },
    { key: 'writing', label: t.progress.writing, value: progress.writing_score },
    { key: 'reading', label: t.progress.reading, value: progress.reading_score },
    { key: 'speaking', label: t.progress.speaking, value: progress.speaking_score },
    { key: 'vocabulary', label: t.progress.vocabulary, value: progress.vocabulary_score },
  ]

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
            {profile.derived_level && (
              <span className="chip">
                {t.dashboard.levelLabel} <b>{profile.derived_level}</b>
              </span>
            )}
            {profile.tibetan_variety && (
              <span className="chip">
                {t.dashboard.classLabel} <b>{profile.tibetan_variety}</b>
              </span>
            )}
            {profile.native_language && (
              <span className="chip">
                {t.dashboard.nativeLabel} <b>{profile.native_language}</b>
              </span>
            )}
            {Array.isArray(profile.goals) && profile.goals.length > 0 && (
              <span className="chip">
                {t.dashboard.goalsLabel}{' '}
                <b>{profile.goals.slice(0, 2).join(', ')}</b>
              </span>
            )}
            {Array.isArray(profile.interests) && profile.interests.length > 0 && (
              <span className="chip">
                {t.dashboard.likes} <b>{profile.interests.slice(0, 3).join(', ')}</b>
              </span>
            )}
            {profile.daily_minutes != null && (
              <span className="chip">
                {t.dashboard.dailyLabel}{' '}
                <b dir="ltr">
                  {profile.daily_minutes === 0 ? '∞' : `${profile.daily_minutes}m`}
                </b>
              </span>
            )}
            {profile.age != null && (
              <span className="chip">
                {t.dashboard.age} <b dir="ltr">{profile.age}</b>
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
        <div className="stat dash-stat-path">
          <div className="dash-stat-path-row">
            <div>
              <div className="label">{t.dashboard.path}</div>
              <div className="value value-sm">{roadmapTitle}</div>
              <div className="stat-meta">
                {t.dashboard.week} <span dir="ltr">{currentWeek}</span>
              </div>
            </div>
            <RingStat
              completed={weekCompletion.completed}
              total={weekCompletion.total}
              label={t.dashboard.weekDone}
              sublabel={t.dashboard.weekDoneSub}
            />
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

      <section className="dash-charts">
        <div className="panel dash-chart-panel">
          <h3>{t.dashboard.practiceTrend}</h3>
          {practiceScores.length ? (
            <LineChart points={practiceScores} isEn={isEn} />
          ) : (
            <div className="chart-empty-block">
              <p className="chart-empty">{t.dashboard.chartEmpty}</p>
              <Link className="btn btn-primary" to="/practice">
                {t.dashboard.chartEmptyPractice}
              </Link>
            </div>
          )}
        </div>
        <div className="panel dash-chart-panel">
          <h3>{t.dashboard.activityTrend}</h3>
          {activitySeries.some(
            (d) =>
              (d.practices_completed || 0) + (d.stories || 0) + (d.mistakes || 0) > 0,
          ) ? (
            <BarChart
              days={activitySeries}
              labels={{
                practices: t.dashboard.seriesPractice,
                stories: t.dashboard.seriesStories,
                mistakes: t.dashboard.seriesMistakes,
              }}
              isEn={isEn}
            />
          ) : (
            <div className="chart-empty-block">
              <p className="chart-empty">{t.dashboard.chartEmpty}</p>
              <div className="dash-chart-empty-actions">
                <Link className="btn btn-primary" to="/practice">
                  {t.dashboard.chartEmptyPractice}
                </Link>
                <Link className="btn btn-accent" to="/story">
                  {t.dashboard.chartEmptyStory}
                </Link>
              </div>
            </div>
          )}
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
              <h4 className="dash-next-title">
                {tibetanOrFallback(next.title, t.dashboard.continueLearning, lang)}
              </h4>
              <div className="meta">
                {lessonTypeBo(next.lesson_type, lang)} · {statusBo(next.status, lang)}
              </div>
              <Link className="btn btn-primary dash-next-cta" to={`/lessons/${next.id}`}>
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
            <Link className="btn btn-ghost" to="/story">
              {t.nav.story}
            </Link>
            <Link className="btn btn-accent" to="/practice">
              {t.dashboard.todayPractice}
            </Link>
          </div>
        </section>

        <div className="dash-side">
          <section className="panel dash-skills-panel">
            <h3 style={{ marginTop: 0 }}>{t.dashboard.skillsRadar}</h3>
            <RadarChart skills={skillItems} emptyLabel={t.dashboard.chartEmpty} />
            <ul className="dash-skill-legend">
              {skillItems.map((s) => (
                <li key={s.key}>
                  <span>{s.label}</span>
                  <strong dir="ltr">{Math.round(s.value)}</strong>
                </li>
              ))}
            </ul>
          </section>

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
            <h3 style={{ marginTop: 0 }}>{t.nav.story}</h3>
            <p className="muted">{t.story.sub}</p>
            <Link className="btn btn-primary" to="/story" style={{ marginTop: 10 }}>
              {t.story.generate}
            </Link>
          </section>
        </div>
      </div>
    </div>
  )
}
