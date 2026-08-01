import { lessonTypeBo, statusBo } from '../i18n/labels'
import { lessonTypeGlyph } from '../lib/lessonNav'
import { useI18n } from '../i18n/useI18n'

export default function LessonCard({
  title,
  lessonType,
  weekNumber,
  status,
  content,
  selected,
  onClick,
  onOpen,
  index = 0,
}) {
  const { t } = useI18n()

  const glyph = lessonTypeGlyph(lessonType)
  const st = status || 'pending'

  return (
    <article
      className={`lesson-card tibetan is-clickable path-card-enter status-${st} ${selected ? 'is-selected' : ''}`}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
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
      role="button"
      tabIndex={0}
    >
      <div className={`lesson-status-ribbon status-${st}`}>{statusBo(st)}</div>
      <div className="lesson-card-top">
        <span className="path-type-glyph sm" aria-hidden>
          {glyph}
        </span>
        <div className="meta">
          {t.common.week} {weekNumber} · {lessonTypeBo(lessonType)}
        </div>
      </div>
      <h3 style={{ margin: '8px 0 6px', fontSize: '1.15rem' }}>{title}</h3>
      {content && (
        <p style={{ margin: 0, color: 'var(--muted)' }} className="lesson-card-desc">
          {content}
        </p>
      )}
      {onOpen && (
        <button
          type="button"
          className="btn btn-primary lesson-card-open"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
        >
          {st === 'completed' || st === 'in_progress'
            ? t.modules.continue
            : t.learningPath.goToCourse}
        </button>
      )}
    </article>
  )
}
