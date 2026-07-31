import LessonCard from './LessonCard'
import { bo } from '../i18n/bo'

export default function Roadmap({ plan }) {
  if (!plan) return <div className="empty tibetan">{bo.learningPath.noPlan}</div>

  const weeks = plan.roadmap_json?.weeks || []
  const lessons = plan.lessons || []

  return (
    <div className="tibetan">
      <div className="panel" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>{plan.title}</h2>
        <p style={{ color: 'var(--muted)' }} dir="ltr">
          {plan.roadmap_json?.summary}
        </p>
        <p>
          {bo.learningPath.currentWeek}: <strong dir="ltr">{plan.current_week}</strong> ·{' '}
          {bo.learningPath.status}: {plan.status}
        </p>
      </div>

      {weeks.map((week) => (
        <section className="roadmap-week" key={week.week_number}>
          <h3>
            {bo.learningPath.week} {week.week_number}: {week.focus}
          </h3>
          {!!week.goals?.length && (
            <ul dir="ltr">
              {week.goals.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          )}
          <div className="grid-3">
            {(week.lessons || []).map((lesson, i) => (
              <LessonCard
                key={i}
                title={lesson.title}
                lessonType={lesson.type || 'lesson'}
                weekNumber={week.week_number}
                status={bo.common.planned}
                content={lesson.description}
              />
            ))}
          </div>
        </section>
      ))}

      {!weeks.length && lessons.length > 0 && (
        <div className="grid-3">
          {lessons.map((l) => (
            <LessonCard
              key={l.id}
              title={l.title}
              lessonType={l.lesson_type}
              weekNumber={l.week_number}
              status={l.status}
              content={l.content}
            />
          ))}
        </div>
      )}
    </div>
  )
}
