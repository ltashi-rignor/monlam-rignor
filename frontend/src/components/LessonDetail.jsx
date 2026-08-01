import { useState } from 'react'
import { Link } from 'react-router-dom'
import { lessonDestination, isActivityLesson, lessonTypeGlyph } from '../lib/lessonNav'
import { lessonTypeBo, statusBo, tibetanOrFallback } from '../i18n/labels'
import { useI18n } from '../i18n/useI18n'

export default function LessonDetail({ lesson, busy, onClose, onOpenCourse, onComplete }) {
  const { t } = useI18n()

  const [ticked, setTicked] = useState(() => new Set())

  if (!lesson) return null

  const hasId = lesson.id != null && String(lesson.id).length > 0
  const done = lesson.status === 'completed'
  const type = (lesson.lesson_type || '').toLowerCase()
  const title = tibetanOrFallback(lesson.title, lessonTypeBo(lesson.lesson_type))
  const focus = tibetanOrFallback(lesson.week_focus, '')
  const goals = (lesson.goals || [])
    .map((g) => tibetanOrFallback(g, ''))
    .filter(Boolean)
  const description = tibetanOrFallback(lesson.content || lesson.description, '')
  const href = lessonDestination(lesson)
  const activity = isActivityLesson(lesson)
  const isGame = type.includes('game')
  const glyph = lessonTypeGlyph(lesson.lesson_type)

  const openLabel = done
    ? t.modules.continue
    : isGame
      ? t.learningPath.openGame
      : activity
        ? t.learningPath.goToActivity
        : t.learningPath.goToCourse

  function toggleGoal(i) {
    setTicked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <aside className="lesson-detail panel tibetan path-mission" aria-label={t.learningPath.lessonDetail}>
      <div className="lesson-detail-head">
        <div className="path-mission-title">
          <span className="path-type-glyph" aria-hidden>
            {glyph}
          </span>
          <div>
            <p className="meta">
              {t.learningPath.week} {lesson.week_number} · {lessonTypeBo(lesson.lesson_type)} ·{' '}
              <span className={`status-pill status-${lesson.status || 'pending'}`}>
                {statusBo(lesson.status)}
              </span>
            </p>
            <h2>{title}</h2>
          </div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {t.learningPath.close}
        </button>
      </div>

      {focus && (
        <p className="lesson-detail-focus">
          {t.learningPath.focus}: {focus}
        </p>
      )}

      {lesson.estimated_minutes != null && (
        <p className="meta" dir="ltr">
          ~{lesson.estimated_minutes} {t.learningPath.minutes}
        </p>
      )}

      {!!goals.length && (
        <div className="lesson-detail-block">
          <h3>{t.learningPath.mission}</h3>
          <ul className="mission-checklist">
            {goals.map((g, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={`mission-check ${ticked.has(i) ? 'is-ticked' : ''}`}
                  onClick={() => toggleGoal(i)}
                >
                  <span className="mission-box" aria-hidden>
                    {ticked.has(i) ? '✓' : ''}
                  </span>
                  <span>{g}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {description && (
        <div className="lesson-detail-block">
          <h3>{t.learningPath.description}</h3>
          <p>{description}</p>
        </div>
      )}

      {!href && (
        <p className="muted" style={{ marginTop: 12 }}>
          {t.learningPath.needRegen}
        </p>
      )}

      <div className="lesson-detail-actions">
        {href && (
          <Link
            className="btn btn-primary path-cta-pulse"
            to={href}
            onClick={() => {
              if (onOpenCourse) onOpenCourse()
            }}
          >
            {openLabel}
          </Link>
        )}
        {!done && hasId && (
          <button type="button" className="btn btn-accent" disabled={busy} onClick={onComplete}>
            {busy ? t.learningPath.marking : t.learningPath.markDone}
          </button>
        )}
        {!activity && (type.includes('practice') || type.includes('quiz')) ? (
          <Link className="btn btn-ghost" to="/practice">
            {t.learningPath.openPractice}
          </Link>
        ) : null}
        {!activity && (type.includes('grammar') || type.includes('writing')) ? (
          <Link className="btn btn-ghost" to="/grammar">
            {t.learningPath.openGrammar}
          </Link>
        ) : null}
      </div>
    </aside>
  )
}
