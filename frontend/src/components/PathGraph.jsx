import { lessonTypeBo, statusBo, tibetanOrFallback } from '../i18n/labels'
import { sameLessonId, lessonTypeGlyph } from '../lib/lessonNav'
import { bo } from '../i18n/bo'

function weekPct(lessons) {
  const total = lessons.length || 1
  const completed = lessons.filter((l) => l.status === 'completed').length
  const inProgress = lessons.filter((l) => l.status === 'in_progress').length
  return Math.round(((completed + inProgress * 0.5) / total) * 100)
}

export default function PathGraph({ weeks, currentWeek, selectedId, onSelectLesson, onOpenLesson }) {
  if (!weeks.length) return null

  return (
    <section className="path-graph panel tibetan path-journey">
      <div className="path-graph-head">
        <h2>{bo.learningPath.pathGraph}</h2>
        <p className="muted">{bo.learningPath.journeyHint}</p>
      </div>

      <div className="path-track" role="list">
        {weeks.map((week, wi) => {
          const pct = weekPct(week.lessons)
          const isCurrent = week.week_number === currentWeek
          const isPast = week.week_number < currentWeek
          const focus = tibetanOrFallback(week.focus, '')
          const allDone = pct === 100

          return (
            <div
              key={week.week_number}
              className={`path-week-node path-node-enter ${isCurrent ? 'is-current' : ''} ${isPast || allDone ? 'is-done' : ''}`}
              style={{ animationDelay: `${wi * 80}ms` }}
              role="listitem"
            >
              {wi > 0 && <div className="path-connector" aria-hidden />}
              <div className={`path-week-orb ${isCurrent ? 'is-pulse' : ''}`}>
                {allDone ? <span className="path-orb-check">✓</span> : <span dir="ltr">{week.week_number}</span>}
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
                    const selected = sameLessonId(selectedId, lesson.id)
                    const status = lesson.status || 'pending'
                    const glyph = lessonTypeGlyph(lesson.lesson_type)
                    return (
                      <div
                        key={lesson.id || `${week.week_number}-${lesson.order_index}`}
                        className={`path-dot-wrap status-${status} ${selected ? 'is-selected' : ''} ${status === 'in_progress' ? 'is-breathe' : ''}`}
                      >
                        <button
                          type="button"
                          className={`path-dot status-${status} ${selected ? 'is-selected' : ''}`}
                          title={title}
                          onClick={() => onSelectLesson(lesson)}
                        >
                          <span className="path-dot-glyph" aria-hidden>
                            {status === 'completed' ? '✓' : glyph}
                          </span>
                          <span className="path-dot-label">{lessonTypeBo(lesson.lesson_type)}</span>
                          <span className="path-dot-title">{title}</span>
                          <span className="path-dot-status">{statusBo(status)}</span>
                        </button>
                        {onOpenLesson && (
                          <button
                            type="button"
                            className="btn btn-primary path-dot-open"
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpenLesson(lesson)
                            }}
                          >
                            {status === 'completed' ? bo.modules.continue : bo.learningPath.goToCourse}
                          </button>
                        )}
                      </div>
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
