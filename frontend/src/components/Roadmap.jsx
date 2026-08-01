import LessonCard from './LessonCard'
import { sameLessonId } from '../lib/lessonNav'
import { useI18n } from '../i18n/useI18n'
import { tibetanOrFallback } from '../i18n/labels'

function weekProgress(lessons) {
  const total = lessons.length
  if (!total) return { done: 0, total: 0, pct: 0 }
  const completed = lessons.filter((l) => l.status === 'completed').length
  const inProgress = lessons.filter((l) => l.status === 'in_progress').length
  const weighted = completed + inProgress * 0.5
  return {
    done: completed,
    total,
    pct: Math.round((weighted / total) * 100),
  }
}

export default function Roadmap({ weeks, selectedId, onSelectLesson, onOpenLesson }) {
  const { t } = useI18n()

  if (!weeks?.length) return <div className="empty tibetan">{t.learningPath.noPlan}</div>

  return (
    <div className="tibetan roadmap-list">
      {weeks.map((week) => {
        const { done, total, pct } = weekProgress(week.lessons)
        const focus = tibetanOrFallback(week.focus, '')
        const goals = (week.goals || [])
          .map((g) => tibetanOrFallback(g, ''))
          .filter(Boolean)

        return (
          <section className="roadmap-week" key={week.week_number}>
            <div className="roadmap-week-head">
              <h3>
                {t.learningPath.week} {week.week_number}
                {focus ? `: ${focus}` : ''}
              </h3>
              <div className="roadmap-week-stats">
                <span dir="ltr">
                  {done}/{total} · {pct}%
                </span>
                {pct === 100 && <span className="badge-done">{t.learningPath.weekComplete}</span>}
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
              {week.lessons.map((lesson, i) => (
                <LessonCard
                  key={lesson.id || `${week.week_number}-${lesson.order_index}`}
                  title={tibetanOrFallback(lesson.title, t.common.lesson)}
                  lessonType={lesson.lesson_type}
                  weekNumber={week.week_number}
                  status={lesson.status || 'pending'}
                  content={tibetanOrFallback(lesson.content || lesson.description, '')}
                  selected={sameLessonId(selectedId, lesson.id)}
                  onClick={() => onSelectLesson(lesson)}
                  onOpen={onOpenLesson ? () => onOpenLesson(lesson) : undefined}
                  index={i}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
