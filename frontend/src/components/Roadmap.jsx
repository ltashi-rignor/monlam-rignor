import LessonCard from './LessonCard'
import { bo } from '../i18n/bo'
import { tibetanOrFallback } from '../i18n/labels'

export default function Roadmap({ weeks, selectedId, onSelectLesson }) {
  if (!weeks?.length) return <div className="empty tibetan">{bo.learningPath.noPlan}</div>

  return (
    <div className="tibetan roadmap-list">
      {weeks.map((week) => {
        const done = week.lessons.filter((l) => l.status === 'completed').length
        const total = week.lessons.length
        const pct = total ? Math.round((done / total) * 100) : 0
        const focus = tibetanOrFallback(week.focus, '')
        const goals = (week.goals || [])
          .map((g) => tibetanOrFallback(g, ''))
          .filter(Boolean)

        return (
          <section className="roadmap-week" key={week.week_number}>
            <div className="roadmap-week-head">
              <h3>
                {bo.learningPath.week} {week.week_number}
                {focus ? `: ${focus}` : ''}
              </h3>
              <div className="roadmap-week-stats">
                <span dir="ltr">
                  {done}/{total} · {pct}%
                </span>
                {pct === 100 && <span className="badge-done">{bo.learningPath.weekComplete}</span>}
              </div>
            </div>
            <div className="week-progress-bar" aria-hidden>
              <div className="week-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            {!!goals.length && (
              <ul className="week-goals">
                {goals.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            )}
            <div className="grid-3">
              {week.lessons.map((lesson) => (
                <LessonCard
                  key={lesson.id || `${week.week_number}-${lesson.order_index}`}
                  title={tibetanOrFallback(lesson.title, bo.common.lesson)}
                  lessonType={lesson.lesson_type}
                  weekNumber={week.week_number}
                  status={lesson.status || 'pending'}
                  content={tibetanOrFallback(lesson.content || lesson.description, '')}
                  selected={selectedId === lesson.id}
                  onClick={lesson.id ? () => onSelectLesson(lesson) : undefined}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
