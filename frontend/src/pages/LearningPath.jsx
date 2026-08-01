import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import LessonDetail from '../components/LessonDetail'
import PathGraph from '../components/PathGraph'
import Roadmap from '../components/Roadmap'
import WorkingProgress from '../components/WorkingProgress'
import { lessonDestination, isActivityLesson, lessonTypeGlyph } from '../lib/lessonNav'
import { useI18n } from '../i18n/useI18n'
import { lessonTypeBo, statusBo, tibetanOrFallback } from '../i18n/labels'

function buildWeeks(plan) {
  if (!plan) return []
  const dbLessons = [...(plan.lessons || [])].sort(
    (a, b) => a.week_number - b.week_number || a.order_index - b.order_index,
  )
  const jsonWeeks = plan.roadmap_json?.weeks || []

  if (dbLessons.length) {
    const byWeek = new Map()
    for (const lesson of dbLessons) {
      const wn = lesson.week_number
      if (!byWeek.has(wn)) {
        const meta = jsonWeeks.find((w) => Number(w.week_number) === wn) || {}
        byWeek.set(wn, {
          week_number: wn,
          focus: meta.focus || '',
          goals: meta.goals || [],
          lessons: [],
        })
      }
      byWeek.get(wn).lessons.push({
        ...lesson,
        id: lesson.id != null ? String(lesson.id) : null,
        description: lesson.content,
      })
    }
    return [...byWeek.values()].sort((a, b) => a.week_number - b.week_number)
  }

  return jsonWeeks.map((week) => ({
    week_number: week.week_number,
    focus: week.focus,
    goals: week.goals || [],
    lessons: (week.lessons || []).map((l, i) => ({
      id: null,
      title: l.title,
      content: l.description,
      description: l.description,
      lesson_type: l.type || 'lesson',
      week_number: week.week_number,
      order_index: i,
      status: 'pending',
      estimated_minutes: l.estimated_minutes,
    })),
  }))
}

export default function LearningPath() {
  const { t, isEn, lang } = useI18n()
  const navigate = useNavigate()
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [detailBusy, setDetailBusy] = useState(false)
  const [selected, setSelected] = useState(null)
  const [noPlan, setNoPlan] = useState(false)

  const weeks = useMemo(() => buildWeeks(plan), [plan])

  const allLessons = useMemo(() => weeks.flatMap((w) => w.lessons), [weeks])

  const stats = useMemo(() => {
    const completed = allLessons.filter((l) => l.status === 'completed').length
    const inProgress = allLessons.filter((l) => l.status === 'in_progress').length
    const total = allLessons.length
    // Count started lessons so the bar moves before "mark done"
    const weighted = completed + inProgress * 0.5
    return {
      total,
      completed,
      inProgress,
      pct: total ? Math.round((weighted / total) * 100) : 0,
    }
  }, [allLessons])

  const continueLesson = useMemo(() => {
    return (
      allLessons.find((l) => l.status === 'in_progress') ||
      allLessons.find((l) => l.status !== 'completed' && lessonDestination(l)) ||
      null
    )
  }, [allLessons])

  async function load() {
    try {
      const data = await api.getRoadmap()
      setPlan(data)
      setNoPlan(false)
      setError('')
      return data
    } catch (err) {
      const missing = /no learning plan/i.test(err.message || '')
      setNoPlan(missing)
      setPlan(null)
      setError(missing ? '' : err.message)
      return null
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const data = await load()
      if (cancelled || !data) return
      const lessons = [...(data.lessons || [])].map((l) => ({
        ...l,
        id: l.id != null ? String(l.id) : null,
      }))

      // Heal: activity modules left as in_progress should count as completed
      const stuck = lessons.filter(
        (l) => l.id && l.status === 'in_progress' && isActivityLesson(l),
      )
      for (const lesson of stuck) {
        try {
          await api.updateLessonStatus(String(lesson.id), 'completed')
        } catch {
          /* ignore */
        }
      }
      if (stuck.length) {
        const refreshed = await load()
        if (cancelled || !refreshed) return
        lessons.splice(
          0,
          lessons.length,
          ...(refreshed.lessons || []).map((l) => ({
            ...l,
            id: l.id != null ? String(l.id) : null,
          })),
        )
      }

      const resume =
        lessons.find((l) => l.status === 'in_progress') ||
        lessons.find((l) => l.status !== 'completed')
      if (resume?.id) {
        try {
          const detail = await api.getLesson(resume.id)
          if (!cancelled) {
            setSelected({
              ...detail,
              id: detail.id != null ? String(detail.id) : resume.id,
            })
          }
        } catch {
          if (!cancelled) setSelected(resume)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function regenerate(force = true) {
    setBusy(true)
    setError('')
    setSelected(null)
    try {
      const data = await api.generateRoadmap(force)
      setPlan(data)
      setNoPlan(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function selectLesson(lesson) {
    if (!lesson) return
    const weekMeta = weeks.find((w) => w.week_number === lesson.week_number)
    if (!lesson.id) {
      setSelected({
        ...lesson,
        week_focus: weekMeta?.focus,
        goals: weekMeta?.goals || [],
      })
      return
    }
    const lid = String(lesson.id)
    setDetailBusy(true)
    setError('')
    // Show roadmap card immediately so UI never feels stuck
    setSelected({ ...lesson, id: lid, week_focus: weekMeta?.focus, goals: weekMeta?.goals || [] })
    try {
      const detail = await api.getLesson(lid)
      setSelected({
        ...detail,
        id: detail.id != null ? String(detail.id) : lid,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setDetailBusy(false)
    }
  }

  async function patchStatus(status) {
    if (!selected?.id) return
    setDetailBusy(true)
    setError('')
    try {
      const updated = await api.updateLessonStatus(String(selected.id), status)
      setSelected({
        ...updated,
        id: updated.id != null ? String(updated.id) : String(selected.id),
      })
      const data = await api.getRoadmap()
      setPlan(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setDetailBusy(false)
    }
  }

  function markOpened(lesson) {
    if (!lesson?.id) return
    // Practice modules have no quiz gate — opening counts as done.
    // Interactive lessons stay in_progress until quiz / mark done.
    const nextStatus = isActivityLesson(lesson)
      ? 'completed'
      : lesson.status === 'pending'
        ? 'in_progress'
        : null
    if (!nextStatus || lesson.status === nextStatus) return
    api
      .updateLessonStatus(String(lesson.id), nextStatus)
      .then(() => api.getRoadmap())
      .then((data) => {
        setPlan(data)
        if (selected && String(selected.id) === String(lesson.id)) {
          setSelected((prev) => (prev ? { ...prev, status: nextStatus } : prev))
        }
      })
      .catch(() => {})
  }

  function openLesson(lesson) {
    const target = lesson || selected
    if (!target) return
    const href = lessonDestination(target)
    if (!href) {
      setError(t.learningPath.needRegen)
      selectLesson(target)
      return
    }
    markOpened(target)
    navigate(href)
  }

  if (noPlan && !plan) {
    return (
      <div className={`learning-path-page ${isEn ? 'is-en' : 'tibetan'}`}>
        <header className="page-header">
          <div>
            <h1>{t.learningPath.title}</h1>
            <p>{t.learningPath.sub}</p>
          </div>
        </header>
        {error && <p className="error">{error}</p>}
        <div className="panel empty">
          <p>{t.learningPath.noPlan}</p>
          <WorkingProgress
            active={busy}
            title={t.learningPath.pathTitle}
            stages={[
              t.learningPath.pathStage1,
              t.learningPath.pathStage2,
              t.learningPath.pathStage3,
            ]}
          />
          <button className="btn btn-primary" onClick={() => regenerate(false)} disabled={busy}>
            {busy ? t.learningPath.creating : t.learningPath.createFirst}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`learning-path-page ${isEn ? 'is-en' : 'tibetan'}`}>
      <header className="page-header">
        <div>
          <h1>{t.learningPath.title}</h1>
          <p>{t.learningPath.sub}</p>
        </div>
        <div className="path-header-actions">
          {continueLesson && (
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => openLesson(continueLesson)}
            >
              {t.modules.continue}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => regenerate(true)} disabled={busy}>
            {busy ? t.learningPath.regenerating : t.learningPath.regenerate}
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <WorkingProgress
        active={busy}
        title={t.learningPath.pathTitle}
        stages={[
          t.learningPath.pathStage1,
          t.learningPath.pathStage2,
          t.learningPath.pathStage3,
        ]}
      />

      {plan && (
        <div className="path-overview panel path-hero-stage">
          <div>
            <h2 style={{ margin: '0 0 6px' }}>
              {tibetanOrFallback(plan.title, t.learningPath.title, lang)}
            </h2>
            {tibetanOrFallback(plan.roadmap_json?.summary, '', lang) && (
              <p className="muted" style={{ margin: 0 }}>
                {tibetanOrFallback(plan.roadmap_json.summary, '', lang)}
              </p>
            )}
          </div>
          <div className="path-overview-stats">
            <div className="stat-chip">
              <span>{t.learningPath.currentWeek}</span>
              <strong dir="ltr">{plan.current_week}</strong>
            </div>
            <div className="stat-chip">
              <span>{t.learningPath.status}</span>
              <strong>{statusBo(plan.status, lang)}</strong>
            </div>
            <div className="stat-chip">
              <span>{t.learningPath.progress}</span>
              <strong dir="ltr">
                {stats.completed}/{stats.total} · {stats.pct}%
              </strong>
            </div>
            {stats.inProgress > 0 && (
              <div className="stat-chip">
                <span>{statusBo('in_progress', lang)}</span>
                <strong dir="ltr">{stats.inProgress}</strong>
              </div>
            )}
          </div>
          <div className="overview-progress" aria-hidden>
            <div className="overview-progress-fill" style={{ width: `${stats.pct}%` }} />
          </div>
          {continueLesson && (
            <div className="path-now-playing">
              <div className="path-now-playing-glow" aria-hidden />
              <span className="path-type-glyph lg" aria-hidden>
                {lessonTypeGlyph(continueLesson.lesson_type)}
              </span>
              <div className="path-now-playing-body">
                <p className="path-now-label">
                  <span className="path-live-dot" aria-hidden />
                  {t.learningPath.nowPlaying}
                </p>
                <h3>{tibetanOrFallback(continueLesson.title, t.common.lesson, lang)}</h3>
                <p className="meta">
                  {lessonTypeBo(continueLesson.lesson_type, lang)} ·{' '}
                  {statusBo(continueLesson.status, lang)}
                  {continueLesson.estimated_minutes != null
                    ? ` · ~${continueLesson.estimated_minutes} ${t.learningPath.minutes}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary path-cta-pulse"
                onClick={() => openLesson(continueLesson)}
              >
                {t.learningPath.goToCourse}
              </button>
            </div>
          )}
        </div>
      )}

      <PathGraph
        weeks={weeks}
        currentWeek={plan?.current_week || 1}
        selectedId={selected?.id}
        onSelectLesson={selectLesson}
        onOpenLesson={openLesson}
      />

      <div className={`path-split ${selected ? 'has-detail' : ''}`}>
        <Roadmap
          weeks={weeks}
          selectedId={selected?.id}
          onSelectLesson={selectLesson}
          onOpenLesson={openLesson}
        />
        {selected && (
          <LessonDetail
            lesson={selected}
            busy={detailBusy}
            onClose={() => setSelected(null)}
            onOpenCourse={() => markOpened(selected)}
            onComplete={() => patchStatus('completed')}
          />
        )}
      </div>
    </div>
  )
}
