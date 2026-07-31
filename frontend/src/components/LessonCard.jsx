import { bo } from '../i18n/bo'

export default function LessonCard({ title, lessonType, weekNumber, status, content }) {
  return (
    <article className="lesson-card tibetan">
      <div className="meta">
        {bo.common.week} {weekNumber} · {lessonType} · {status}
      </div>
      <h3 style={{ margin: '8px 0 6px', fontSize: '1.15rem' }}>{title}</h3>
      {content && (
        <p style={{ margin: 0, color: 'var(--muted)' }} dir="ltr">
          {content}
        </p>
      )}
    </article>
  )
}
