import { lessonTypeBo, statusBo, tibetanOrFallback } from '../i18n/labels'
import { bo } from '../i18n/bo'

export default function PathGraph({ weeks, currentWeek, selectedId, onSelectLesson }) {
  if (!weeks.length) return null

  return (
    <section className="path-graph panel tibetan">
      <div className="path-graph-head">
        <h2>{bo.learningPath.pathGraph}</h2>
        <p className="muted">{bo.learningPath.clickLesson}</p>
      </div>

      <div className="path-track" role="list">
        {weeks.map((week, wi) => {
          const done = week.lessons.filter((l) => l.status === 'completed').length
          const total = week.lessons.length || 1
          const pct = Math.round((done / total) * 100)
          const isCurrent = week.week_number === currentWeek
          const isPast = week.week_number < currentWeek
          const focus = tibetanOrFallback(week.focus, '')

          return (
            <div
              key={week.week_number}
              className={`path-week-node ${isCurrent ? 'is-current' : ''} ${isPast || pct === 100 ? 'is-done' : ''}`}
              role="listitem"
            >
              {wi > 0 && <div className="path-connector" aria-hidden />}
              <div className="path-week-orb">
                <span dir="ltr">{week.week_number}</span>
              </div>
              <div className="path-week-body">
                <div className="path-week-meta">
                  <strong>
                    {bo.learningPath.week} {week.week_number}
                  </strong>
                  <span className="path-pct" dir="ltr">
                    {pct}%
                  </span>
                </div>
                {focus ? <p className="path-focus">{focus}</p> : null}
                <div className="path-bar" aria-hidden>
                  <div className="path-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="path-lesson-dots">
                  {week.lessons.map((lesson) => {
                    const title = tibetanOrFallback(
                      lesson.title,
                      lessonTypeBo(lesson.lesson_type),
                    )
                    return (
                      <button
                        key={lesson.id || `${week.week_number}-${lesson.order_index}`}
                        type="button"
                        className={`path-dot status-${lesson.status || 'pending'} ${
                          selectedId === lesson.id ? 'is-selected' : ''
                        }`}
                        title={title}
                        onClick={() => onSelectLesson(lesson)}
                      >
                        <span className="path-dot-label">{lessonTypeBo(lesson.lesson_type)}</span>
                        <span className="path-dot-title">{title}</span>
                        <span className="path-dot-status">{statusBo(lesson.status)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
