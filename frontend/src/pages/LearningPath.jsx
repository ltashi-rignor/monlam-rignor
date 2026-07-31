import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import LessonDetail from '../components/LessonDetail'
import PathGraph from '../components/PathGraph'
import Roadmap from '../components/Roadmap'
import { bo } from '../i18n/bo'
import { statusBo, tibetanOrFallback } from '../i18n/labels'

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
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [detailBusy, setDetailBusy] = useState(false)
  const [selected, setSelected] = useState(null)

  const weeks = useMemo(() => buildWeeks(plan), [plan])

  const stats = useMemo(() => {
    const all = weeks.flatMap((w) => w.lessons)
    const completed = all.filter((l) => l.status === 'completed').length
    return {
      total: all.length,
      completed,
      pct: all.length ? Math.round((completed / all.length) * 100) : 0,
    }
  }, [weeks])

  async function load() {
    try {
      const data = await api.getRoadmap()
      setPlan(data)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function regenerate() {
    setBusy(true)
    setError('')
    setSelected(null)
    try {
      const data = await api.generateRoadmap(true)
      setPlan(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function selectLesson(lesson) {
    if (!lesson?.id) {
      setSelected({
        ...lesson,
        week_focus: weeks.find((w) => w.week_number === lesson.week_number)?.focus,
        goals: weeks.find((w) => w.week_number === lesson.week_number)?.goals || [],
      })
      return
    }
    setDetailBusy(true)
    setError('')
    try {
      const detail = await api.getLesson(lesson.id)
      setSelected(detail)
    } catch (err) {
      setSelected(lesson)
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
      const updated = await api.updateLessonStatus(selected.id, status)
      setSelected(updated)
      const data = await api.getRoadmap()
      setPlan(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setDetailBusy(false)
    }
  }

  return (
    <div className="tibetan learning-path-page">
      <header className="page-header">
        <div>
          <h1>{bo.learningPath.title}</h1>
          <p>{bo.learningPath.sub}</p>
        </div>
        <button className="btn btn-primary" onClick={regenerate} disabled={busy}>
          {busy ? bo.learningPath.regenerating : bo.learningPath.regenerate}
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      {plan && (
        <div className="path-overview panel">
          <div>
            <h2 style={{ margin: '0 0 6px' }}>
              {tibetanOrFallback(plan.title, bo.learningPath.title)}
            </h2>
            {tibetanOrFallback(plan.roadmap_json?.summary, '') && (
              <p className="muted" style={{ margin: 0 }}>
                {tibetanOrFallback(plan.roadmap_json.summary, '')}
              </p>
            )}
          </div>
          <div className="path-overview-stats">
            <div className="stat-chip">
              <span>{bo.learningPath.currentWeek}</span>
              <strong dir="ltr">{plan.current_week}</strong>
            </div>
            <div className="stat-chip">
              <span>{bo.learningPath.status}</span>
              <strong>{statusBo(plan.status)}</strong>
            </div>
            <div className="stat-chip">
              <span>{bo.learningPath.progress}</span>
              <strong dir="ltr">
                {stats.completed}/{stats.total} · {stats.pct}%
              </strong>
            </div>
          </div>
          <div className="overview-progress" aria-hidden>
            <div className="overview-progress-fill" style={{ width: `${stats.pct}%` }} />
          </div>
        </div>
      )}

      <PathGraph
        weeks={weeks}
        currentWeek={plan?.current_week || 1}
        selectedId={selected?.id}
        onSelectLesson={selectLesson}
      />

      <div className={`path-split ${selected ? 'has-detail' : ''}`}>
        <Roadmap weeks={weeks} selectedId={selected?.id} onSelectLesson={selectLesson} />
        {selected && (
          <LessonDetail
            lesson={selected}
            busy={detailBusy}
            onClose={() => setSelected(null)}
            onStart={() => patchStatus('in_progress')}
            onComplete={() => patchStatus('completed')}
          />
        )}
      </div>
    </div>
  )
}
