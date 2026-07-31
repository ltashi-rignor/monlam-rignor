import { lessonTypeBo, statusBo } from '../i18n/labels'
import { bo } from '../i18n/bo'

export default function LessonCard({
  title,
  lessonType,
  weekNumber,
  status,
  content,
  selected,
  onClick,
}) {
  return (
    <article
      className={`lesson-card tibetan ${selected ? 'is-selected' : ''} ${onClick ? 'is-clickable' : ''}`}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="meta">
        {bo.common.week} {weekNumber} · {lessonTypeBo(lessonType)} · {statusBo(status)}
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
