import { Link } from 'react-router-dom'
import { lessonTypeBo, statusBo, tibetanOrFallback } from '../i18n/labels'
import { bo } from '../i18n/bo'

export default function LessonDetail({ lesson, busy, onClose, onStart, onComplete }) {
  if (!lesson) return null

  const done = lesson.status === 'completed'
  const type = (lesson.lesson_type || '').toLowerCase()
  const title = tibetanOrFallback(lesson.title, lessonTypeBo(lesson.lesson_type))
  const focus = tibetanOrFallback(lesson.week_focus, '')
  const goals = (lesson.goals || [])
    .map((g) => tibetanOrFallback(g, ''))
    .filter(Boolean)
  const description = tibetanOrFallback(lesson.content || lesson.description, '')

  return (
    <aside className="lesson-detail panel tibetan" aria-label={bo.learningPath.lessonDetail}>
      <div className="lesson-detail-head">
        <div>
          <p className="meta">
            {bo.learningPath.week} {lesson.week_number} · {lessonTypeBo(lesson.lesson_type)} ·{' '}
            {statusBo(lesson.status)}
          </p>
          <h2>{title}</h2>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {bo.learningPath.close}
        </button>
      </div>

      {focus && (
        <p className="lesson-detail-focus">
          {bo.learningPath.focus}: {focus}
        </p>
      )}

      {lesson.estimated_minutes != null && (
        <p className="meta" dir="ltr">
          ~{lesson.estimated_minutes} {bo.learningPath.minutes}
        </p>
      )}

      {!!goals.length && (
        <div className="lesson-detail-block">
          <h3>{bo.learningPath.goals}</h3>
          <ul>
            {goals.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      {description && (
        <div className="lesson-detail-block">
          <h3>{bo.learningPath.description}</h3>
          <p>{description}</p>
        </div>
      )}

      <div className="lesson-detail-actions">
        {!done && lesson.status !== 'in_progress' && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onStart}>
            {busy ? bo.learningPath.marking : bo.learningPath.start}
          </button>
        )}
        {!done && (
          <button type="button" className="btn btn-accent" disabled={busy} onClick={onComplete}>
            {busy ? bo.learningPath.marking : bo.learningPath.markDone}
          </button>
        )}
        {type.includes('practice') || type.includes('quiz') ? (
          <Link className="btn btn-ghost" to="/practice">
            {bo.learningPath.openPractice}
          </Link>
        ) : null}
        {type.includes('grammar') || type.includes('writing') ? (
          <Link className="btn btn-ghost" to="/grammar">
            {bo.learningPath.openGrammar}
          </Link>
        ) : null}
      </div>
    </aside>
  )
}
