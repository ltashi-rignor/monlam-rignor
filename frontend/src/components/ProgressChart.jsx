import { bo } from '../i18n/bo'

const KEYS = [
  ['grammar_score', bo.progress.grammar],
  ['writing_score', bo.progress.writing],
  ['reading_score', bo.progress.reading],
  ['speaking_score', bo.progress.speaking],
  ['vocabulary_score', bo.progress.vocabulary],
]

export default function ProgressChart({ progress, compact = false }) {
  if (!progress) return <div className="empty tibetan">{bo.loading}</div>

  return (
    <div className="panel tibetan" lang="bo">
      <h3 style={{ marginTop: 0 }}>{bo.progress.skills}</h3>
      <div className="progress-bars">
        {KEYS.map(([key, label]) => {
          const value = Math.max(0, Math.min(100, Number(progress[key] || 0)))
          return (
            <div className="bar-row" key={key}>
              <span>{label}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${value}%` }} />
              </div>
              <strong dir="ltr">{Math.round(value)}</strong>
            </div>
          )
        })}
      </div>

      {!compact && !!progress.learning_graph?.next_focus?.length && (
        <div style={{ marginTop: 18 }}>
          <h4>{bo.progress.nextFocus}</h4>
          <ul>
            {(progress.learning_graph.next_focus || []).map((item, i) => (
              <li key={i} dir="ltr">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
